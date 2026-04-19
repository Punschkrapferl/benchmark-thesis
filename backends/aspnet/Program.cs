using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TodoBench.AspNet.Data;
using TodoBench.AspNet.Dtos;
using TodoBench.AspNet.Models;

// Create the ASP.NET application builder.
// This is the entry point for configuring services and endpoints.
var builder = WebApplication.CreateBuilder(args);

// Hide the default Kestrel server header so responses are closer
// to the Express backend, which also hides its framework header.
builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
});

// If ASPNETCORE_URLS is not already provided externally,
// bind the app to the benchmark port used by the ASP.NET backend.
var aspNetCoreUrls = builder.Configuration["ASPNETCORE_URLS"];
if (string.IsNullOrWhiteSpace(aspNetCoreUrls))
{
    builder.WebHost.UseUrls("http://127.0.0.1:8081");
}

// Register the EF Core DbContext and configure PostgreSQL.
builder.Services.AddDbContext<TodoDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Build the application after service registration is complete.
var app = builder.Build();

// Convert one internal TodoItem entity into the public API response DTO.
// This keeps the API response shape aligned with the benchmark contract.
static TodoResponse ToTodoResponse(HttpRequest request, TodoItem item)
{
    return new TodoResponse
    {
        Id = item.Id,
        Title = item.Title,
        Completed = item.Completed,
        Order = item.Order,
        Url = $"{request.Scheme}://{request.Host}/todos/{item.Id}"
    };
}

// Build a consistent benchmark-friendly bad request payload.
// This matches the Express backend style: { "message": "..." }.
static IResult BadRequestMessage(string message)
{
    return Results.BadRequest(new { message });
}

// Build a consistent benchmark-friendly not-found payload.
static IResult NotFoundMessage(string message)
{
    return Results.NotFound(new { message });
}

// Validate that the route ID is a positive integer.
// This mirrors the Express backend behavior.
static bool TryParseValidTodoId(string rawId, out int todoId)
{
    todoId = 0;

    if (!int.TryParse(rawId, out var parsedId))
    {
        return false;
    }

    if (parsedId <= 0)
    {
        return false;
    }

    todoId = parsedId;
    return true;
}

// Read and parse the request body as JSON.
// Returns a controlled 400 payload for malformed JSON.
static async Task<(bool Success, JsonElement Body, IResult? Error)> TryReadJsonBodyAsync(HttpRequest request)
{
    try
    {
        var body = await JsonSerializer.DeserializeAsync<JsonElement>(request.Body);

        return (true, body, null);
    }
    catch (JsonException)
    {
        return (false, default, BadRequestMessage("Invalid JSON body"));
    }
}

// Validate POST /todos payload from raw JSON.
// This matches the Express backend behavior closely:
// - body must be a JSON object
// - title is required and must be a string
// - completed is optional but, if present, must be a boolean
// - order is optional and may be integer or null
static (bool Success, string? Title, bool Completed, int? Order, IResult? Error) ValidateCreatePayload(JsonElement payload)
{
    if (payload.ValueKind != JsonValueKind.Object)
    {
        return (false, null, false, null, BadRequestMessage("Request body must be a JSON object"));
    }

    if (!payload.TryGetProperty("title", out var titleProperty) ||
        titleProperty.ValueKind != JsonValueKind.String)
    {
        return (false, null, false, null, BadRequestMessage("Field \"title\" is required and must be a string"));
    }

    bool completed = false;
    if (payload.TryGetProperty("completed", out var completedProperty))
    {
        if (completedProperty.ValueKind != JsonValueKind.True &&
            completedProperty.ValueKind != JsonValueKind.False)
        {
            return (false, null, false, null, BadRequestMessage("Field \"completed\" must be a boolean"));
        }

        completed = completedProperty.GetBoolean();
    }

    int? order = null;
    if (payload.TryGetProperty("order", out var orderProperty))
    {
        if (orderProperty.ValueKind == JsonValueKind.Null)
        {
            order = null;
        }
        else if (orderProperty.ValueKind == JsonValueKind.Number &&
                 orderProperty.TryGetInt32(out var orderValue))
        {
            order = orderValue;
        }
        else
        {
            return (false, null, false, null, BadRequestMessage("Field \"order\" must be an integer or null"));
        }
    }

    return (true, titleProperty.GetString(), completed, order, null);
}

// GET /todos
// Return all todos ordered by ascending ID.
app.MapGet("/todos", async (HttpRequest request, TodoDbContext db) =>
{
    var todos = await db.Todos
        .OrderBy(todo => todo.Id)
        .ToListAsync();

    return Results.Ok(todos.Select(todo => ToTodoResponse(request, todo)));
});

// GET /todos/{id}
// Return one todo by ID or the same 400/404 behavior as Express.
app.MapGet("/todos/{id}", async (string id, HttpRequest request, TodoDbContext db) =>
{
    if (!TryParseValidTodoId(id, out var todoId))
    {
        return BadRequestMessage("Invalid todo id");
    }

    var todo = await db.Todos.FindAsync(todoId);

    if (todo is null)
    {
        return NotFoundMessage("Todo not found");
    }

    return Results.Ok(ToTodoResponse(request, todo));
});

// POST /todos
// Create a new todo with explicit validation aligned to the benchmark contract.
app.MapPost("/todos", async (HttpRequest request, TodoDbContext db) =>
{
    var parseResult = await TryReadJsonBodyAsync(request);
    if (!parseResult.Success)
    {
        return parseResult.Error!;
    }

    var validation = ValidateCreatePayload(parseResult.Body);
    if (!validation.Success)
    {
        return validation.Error!;
    }

    var todo = new TodoItem
    {
        Title = validation.Title!,
        Completed = validation.Completed,
        Order = validation.Order
    };

    db.Todos.Add(todo);
    await db.SaveChangesAsync();

    return Results.Created($"/todos/{todo.Id}", ToTodoResponse(request, todo));
});

// PATCH /todos/{id}
// Perform a partial update with support for:
// - omitted fields
// - provided values
// - explicit null for "order"
//
// Important for parity with Express:
// validate the PATCH body first, then check whether the todo exists.
app.MapPatch("/todos/{id}", async (string id, HttpRequest request, TodoDbContext db) =>
{
    if (!TryParseValidTodoId(id, out var todoId))
    {
        return BadRequestMessage("Invalid todo id");
    }

    var parseResult = await TryReadJsonBodyAsync(request);
    if (!parseResult.Success)
    {
        return parseResult.Error!;
    }

    var requestBody = parseResult.Body;

    if (requestBody.ValueKind != JsonValueKind.Object)
    {
        return BadRequestMessage("Request body must be a JSON object");
    }

    // Only these fields are allowed in PATCH.
    var allowedFields = new HashSet<string>(StringComparer.Ordinal)
    {
        "title",
        "completed",
        "order"
    };

    foreach (var property in requestBody.EnumerateObject())
    {
        if (!allowedFields.Contains(property.Name))
        {
            return BadRequestMessage($"Unknown field \"{property.Name}\"");
        }
    }

    // Validate field types first to match Express behavior.
    if (requestBody.TryGetProperty("title", out var titleProperty) &&
        titleProperty.ValueKind != JsonValueKind.String)
    {
        return BadRequestMessage("Field \"title\" must be a string");
    }

    if (requestBody.TryGetProperty("completed", out var completedProperty) &&
        completedProperty.ValueKind != JsonValueKind.True &&
        completedProperty.ValueKind != JsonValueKind.False)
    {
        return BadRequestMessage("Field \"completed\" must be a boolean");
    }

    if (requestBody.TryGetProperty("order", out var orderProperty) &&
        orderProperty.ValueKind != JsonValueKind.Null &&
        !(orderProperty.ValueKind == JsonValueKind.Number && orderProperty.TryGetInt32(out _)))
    {
        return BadRequestMessage("Field \"order\" must be an integer or null");
    }

    // Only after payload validation, check whether the todo exists.
    var todo = await db.Todos.FindAsync(todoId);

    if (todo is null)
    {
        return NotFoundMessage("Todo not found");
    }

    // Apply updates after validation and existence check.
    if (requestBody.TryGetProperty("title", out titleProperty))
    {
        todo.Title = titleProperty.GetString()!;
    }

    if (requestBody.TryGetProperty("completed", out completedProperty))
    {
        todo.Completed = completedProperty.GetBoolean();
    }

    if (requestBody.TryGetProperty("order", out orderProperty))
    {
        if (orderProperty.ValueKind == JsonValueKind.Null)
        {
            todo.Order = null;
        }
        else
        {
            todo.Order = orderProperty.GetInt32();
        }
    }

    await db.SaveChangesAsync();

    return Results.Ok(ToTodoResponse(request, todo));
});

// DELETE /todos/{id}
// Delete one todo by ID or return the same 400/404 behavior as Express.
app.MapDelete("/todos/{id}", async (string id, TodoDbContext db) =>
{
    if (!TryParseValidTodoId(id, out var todoId))
    {
        return BadRequestMessage("Invalid todo id");
    }

    var todo = await db.Todos.FindAsync(todoId);

    if (todo is null)
    {
        return NotFoundMessage("Todo not found");
    }

    db.Todos.Remove(todo);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

// DELETE /todos
// Delete all todos without resetting the identity counter.
// This matches the Express backend semantics more closely.
app.MapDelete("/todos", async (TodoDbContext db) =>
{
    await db.Database.ExecuteSqlRawAsync("DELETE FROM todos;");
    return Results.NoContent();
});

// Final fallback for unknown routes.
// This matches the Express not-found handler payload.
app.MapFallback(() => Results.NotFound(new { message = "Route not found" }));

// Start the ASP.NET application.
app.Run();
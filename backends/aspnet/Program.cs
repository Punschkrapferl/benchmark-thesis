using Microsoft.EntityFrameworkCore;
using TodoBench.AspNet.Data;
using TodoBench.AspNet.Dtos;
using TodoBench.AspNet.Models;

var builder = WebApplication.CreateBuilder(args);

var aspNetCoreUrls = builder.Configuration["ASPNETCORE_URLS"];
if (string.IsNullOrWhiteSpace(aspNetCoreUrls))
{
    builder.WebHost.UseUrls("http://127.0.0.1:8081");
}

builder.Services.AddDbContext<TodoDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

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

app.MapGet("/todos", async (HttpRequest request, TodoDbContext db) =>
{
    var todos = await db.Todos
        .OrderBy(todo => todo.Id)
        .ToListAsync();

    return Results.Ok(todos.Select(todo => ToTodoResponse(request, todo)));
});

app.MapGet("/todos/{id:int}", async (int id, HttpRequest request, TodoDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);

    if (todo is null)
    {
        return Results.NotFound();
    }

    return Results.Ok(ToTodoResponse(request, todo));
});

app.MapPost("/todos", async (HttpRequest request, TodoCreateRequest requestBody, TodoDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(requestBody.Title))
    {
        return Results.BadRequest(new { error = "title is required" });
    }

    var todo = new TodoItem
    {
        Title = requestBody.Title,
        Completed = requestBody.Completed ?? false,
        Order = requestBody.Order
    };

    db.Todos.Add(todo);
    await db.SaveChangesAsync();

    return Results.Created($"/todos/{todo.Id}", ToTodoResponse(request, todo));
});

app.MapPatch("/todos/{id:int}", async (int id, HttpRequest request, TodoPatchRequest requestBody, TodoDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);

    if (todo is null)
    {
        return Results.NotFound();
    }

    if (requestBody.Title is not null)
    {
        if (string.IsNullOrWhiteSpace(requestBody.Title))
        {
            return Results.BadRequest(new { error = "title must not be empty" });
        }

        todo.Title = requestBody.Title;
    }

    if (requestBody.Completed.HasValue)
    {
        todo.Completed = requestBody.Completed.Value;
    }

    if (requestBody.Order is not null)
    {
        todo.Order = requestBody.Order;
    }

    await db.SaveChangesAsync();

    return Results.Ok(ToTodoResponse(request, todo));
});

app.MapDelete("/todos/{id:int}", async (int id, TodoDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);

    if (todo is null)
    {
        return Results.NotFound();
    }

    db.Todos.Remove(todo);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

app.MapDelete("/todos", async (TodoDbContext db) =>
{
    await db.Database.ExecuteSqlRawAsync("TRUNCATE TABLE todos RESTART IDENTITY;");
    return Results.NoContent();
});

app.Run();
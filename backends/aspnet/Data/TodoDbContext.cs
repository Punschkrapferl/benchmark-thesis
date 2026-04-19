using Microsoft.EntityFrameworkCore;
using TodoBench.AspNet.Models;

namespace TodoBench.AspNet.Data;

// EF Core database context for the ASP.NET Todo backend.
// This class maps the C# entity model to the shared PostgreSQL schema
// used across all benchmark backends.
public class TodoDbContext : DbContext
{
    // Inject the EF Core options and pass them to the base DbContext.
    public TodoDbContext(DbContextOptions<TodoDbContext> options) : base(options)
    {
    }

    // Expose the todos table as a DbSet for querying and persistence.
    public DbSet<TodoItem> Todos => Set<TodoItem>();

    // Explicitly configure the database mapping so the ASP.NET backend
    // matches the common schema used by the benchmark.
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TodoItem>(entity =>
        {
            // Map this entity to the existing PostgreSQL table.
            entity.ToTable("todos");

            // Configure the primary key.
            entity.HasKey(todo => todo.Id);

            // Map Id to the "id" column.
            entity.Property(todo => todo.Id)
                .HasColumnName("id");

            // Map Title to "title", use PostgreSQL text type,
            // and mark it as required.
            entity.Property(todo => todo.Title)
                .HasColumnName("title")
                .HasColumnType("text")
                .IsRequired();

            // Map Completed to "completed", make it required,
            // and default it to false.
            entity.Property(todo => todo.Completed)
                .HasColumnName("completed")
                .HasDefaultValue(false)
                .IsRequired();

            // Map Order to the "order" column.
            entity.Property(todo => todo.Order)
                .HasColumnName("order");

            // Map CreatedAt to "created_at", keep the timestamp type,
            // and let PostgreSQL assign CURRENT_TIMESTAMP by default.
            entity.Property(todo => todo.CreatedAt)
                .HasColumnName("created_at")
                .HasColumnType("timestamp")
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .IsRequired();
        });
    }
}
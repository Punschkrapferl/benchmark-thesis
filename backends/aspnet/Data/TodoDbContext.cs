using Microsoft.EntityFrameworkCore;
using TodoBench.AspNet.Models;

namespace TodoBench.AspNet.Data;

public class TodoDbContext : DbContext
{
    public TodoDbContext(DbContextOptions<TodoDbContext> options) : base(options)
    {
    }

    public DbSet<TodoItem> Todos => Set<TodoItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TodoItem>(entity =>
        {
            entity.ToTable("todos");

            entity.HasKey(todo => todo.Id);

            entity.Property(todo => todo.Id)
                .HasColumnName("id");

            entity.Property(todo => todo.Title)
                .HasColumnName("title")
                .HasColumnType("text")
                .IsRequired();

            entity.Property(todo => todo.Completed)
                .HasColumnName("completed")
                .HasDefaultValue(false)
                .IsRequired();

            entity.Property(todo => todo.Order)
                .HasColumnName("order");

            entity.Property(todo => todo.CreatedAt)
                .HasColumnName("created_at")
                .HasColumnType("timestamp")
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .IsRequired();
        });
    }
}
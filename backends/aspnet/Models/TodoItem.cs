namespace TodoBench.AspNet.Models;

// Entity model representing one row in the todos table.
public class TodoItem
{
    // Primary key.
    public int Id { get; set; }

    // Required todo title.
    public string Title { get; set; } = string.Empty;

    // Completion flag. Defaults to false.
    public bool Completed { get; set; } = false;

    // Optional ordering value.
    public int? Order { get; set; }

    // Timestamp assigned by the database on insert.
    public DateTime CreatedAt { get; set; }
}
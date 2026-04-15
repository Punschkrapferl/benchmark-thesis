namespace TodoBench.AspNet.Dtos;

public class TodoPatchRequest
{
    public string? Title { get; set; }

    public bool? Completed { get; set; }

    public int? Order { get; set; }
}
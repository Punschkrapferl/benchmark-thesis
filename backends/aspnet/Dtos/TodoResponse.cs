using System.Text.Json.Serialization;

namespace TodoBench.AspNet.Dtos;

public class TodoResponse
{
    [JsonPropertyOrder(1)]
    public int Id { get; set; }

    [JsonPropertyOrder(2)]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyOrder(3)]
    public bool Completed { get; set; }

    [JsonPropertyOrder(4)]
    public int? Order { get; set; }

    [JsonPropertyOrder(5)]
    public string Url { get; set; } = string.Empty;
}
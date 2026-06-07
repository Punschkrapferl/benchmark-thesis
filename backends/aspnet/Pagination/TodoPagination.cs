namespace TodoBench.AspNet.Pagination;

/// <summary>
/// Keyset pagination options for GET /todos, aligned with the Express reference backend.
/// </summary>
public sealed record TodoPagination(bool Paginated, int? Limit, int AfterId)
{
    public const int MaxLimit = 500;
    public const int DefaultLimit = 100;

    public static TodoPagination FromQueryParams(string? limitParam, string? afterIdParam)
    {
        var hasLimit = limitParam is not null;
        var hasAfterId = afterIdParam is not null;

        if (!hasLimit && !hasAfterId)
        {
            return new TodoPagination(Paginated: false, Limit: null, AfterId: 0);
        }

        var requestedLimit = ParsePositiveInteger(limitParam, DefaultLimit);
        var limit = Math.Min(requestedLimit, MaxLimit);
        var afterId = ParseNonNegativeInteger(afterIdParam, 0);

        return new TodoPagination(Paginated: true, Limit: limit, AfterId: afterId);
    }

    private static int ParsePositiveInteger(string? rawValue, int fallback)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return fallback;
        }

        if (!int.TryParse(rawValue, out var parsed) || parsed <= 0)
        {
            return fallback;
        }

        return parsed;
    }

    private static int ParseNonNegativeInteger(string? rawValue, int fallback)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return fallback;
        }

        if (!int.TryParse(rawValue, out var parsed) || parsed < 0)
        {
            return fallback;
        }

        return parsed;
    }
}

package com.example.todobench.support;

/**
 * Keyset pagination options for GET /todos, aligned with the Express reference backend.
 *
 * - No limit/afterId query params: unbounded list (legacy compatibility).
 * - Any limit or afterId param present: paginated mode using WHERE id > afterId.
 */
public record TodoPagination(boolean paginated, Integer limit, int afterId) {

    public static final int MAX_LIMIT = 500;
    public static final int DEFAULT_LIMIT = 100;

    public static TodoPagination fromQueryParams(String limitParam, String afterIdParam) {
        boolean hasLimit = limitParam != null;
        boolean hasAfterId = afterIdParam != null;

        if (!hasLimit && !hasAfterId) {
            return new TodoPagination(false, null, 0);
        }

        int requestedLimit = parsePositiveInteger(limitParam, DEFAULT_LIMIT);
        int limit = Math.min(requestedLimit, MAX_LIMIT);
        int afterId = parseNonNegativeInteger(afterIdParam, 0);

        return new TodoPagination(true, limit, afterId);
    }

    private static int parsePositiveInteger(String rawValue, int fallback) {
        if (rawValue == null || rawValue.isBlank()) {
            return fallback;
        }

        try {
            int parsed = Integer.parseInt(rawValue.trim());
            if (parsed <= 0) {
                return fallback;
            }
            return parsed;
        } catch (NumberFormatException error) {
            return fallback;
        }
    }

    private static int parseNonNegativeInteger(String rawValue, int fallback) {
        if (rawValue == null || rawValue.isBlank()) {
            return fallback;
        }

        try {
            int parsed = Integer.parseInt(rawValue.trim());
            if (parsed < 0) {
                return fallback;
            }
            return parsed;
        } catch (NumberFormatException error) {
            return fallback;
        }
    }
}

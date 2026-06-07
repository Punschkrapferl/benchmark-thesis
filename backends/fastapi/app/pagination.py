from dataclasses import dataclass


MAX_TODO_PAGE_LIMIT = 500
DEFAULT_TODO_PAGE_LIMIT = 100


@dataclass(frozen=True)
class TodoPagination:
    paginated: bool
    limit: int | None
    after_id: int


def parse_positive_integer(value: str | None, fallback: int) -> int:
    if value is None:
        return fallback

    try:
        parsed = int(value)
    except ValueError:
        return fallback

    if parsed <= 0:
        return fallback

    return parsed


def parse_non_negative_integer(value: str | None, fallback: int) -> int:
    if value is None:
        return fallback

    try:
        parsed = int(value)
    except ValueError:
        return fallback

    if parsed < 0:
        return fallback

    return parsed


def build_pagination_options(
    limit: str | None,
    after_id: str | None,
) -> TodoPagination:
    has_limit = limit is not None
    has_after_id = after_id is not None

    if not has_limit and not has_after_id:
        return TodoPagination(paginated=False, limit=None, after_id=0)

    requested_limit = parse_positive_integer(limit, DEFAULT_TODO_PAGE_LIMIT)
    page_limit = min(requested_limit, MAX_TODO_PAGE_LIMIT)
    page_after_id = parse_non_negative_integer(after_id, 0)

    return TodoPagination(paginated=True, limit=page_limit, after_id=page_after_id)

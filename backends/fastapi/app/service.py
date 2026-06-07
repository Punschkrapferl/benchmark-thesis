from .pagination import TodoPagination
from .repository import TodoRepository


class AppError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class TodoService:
    def __init__(self, repository: TodoRepository) -> None:
        self.repository = repository

    @staticmethod
    def assert_integer_id(value: str) -> int:
        try:
            numeric_id = int(value)
        except (TypeError, ValueError) as exc:
            raise AppError(400, "Invalid todo id") from exc

        if numeric_id <= 0 or str(numeric_id) != str(value):
            raise AppError(400, "Invalid todo id")

        return numeric_id

    @staticmethod
    def is_boolean(value: object) -> bool:
        return isinstance(value, bool)

    @staticmethod
    def is_integer(value: object) -> bool:
        return isinstance(value, int) and not isinstance(value, bool)

    def validate_create_payload(self, payload: object) -> dict:
        if payload is None or not isinstance(payload, dict):
            raise AppError(400, "Request body must be a JSON object")

        if "title" not in payload or not isinstance(payload["title"], str):
            raise AppError(400, 'Field "title" is required and must be a string')

        if "completed" in payload and not self.is_boolean(payload["completed"]):
            raise AppError(400, 'Field "completed" must be a boolean')

        if (
            "order" in payload
            and payload["order"] is not None
            and not self.is_integer(payload["order"])
        ):
            raise AppError(400, 'Field "order" must be an integer or null')

        return {
            "title": payload["title"],
            "completed": payload["completed"] if "completed" in payload else False,
            "order": payload["order"] if "order" in payload else None,
        }

    def validate_patch_payload(self, payload: object) -> dict:
        if payload is None or not isinstance(payload, dict):
            raise AppError(400, "Request body must be a JSON object")

        allowed_keys = {"title", "completed", "order"}

        for key in payload.keys():
            if key not in allowed_keys:
                raise AppError(400, f'Unknown field "{key}"')

        if "title" in payload and not isinstance(payload["title"], str):
            raise AppError(400, 'Field "title" must be a string')

        if "completed" in payload and not self.is_boolean(payload["completed"]):
            raise AppError(400, 'Field "completed" must be a boolean')

        if (
            "order" in payload
            and payload["order"] is not None
            and not self.is_integer(payload["order"])
        ):
            raise AppError(400, 'Field "order" must be an integer or null')

        return {
            "has_title": "title" in payload,
            "title": payload.get("title"),
            "has_completed": "completed" in payload,
            "completed": payload.get("completed"),
            "has_order": "order" in payload,
            "order": payload.get("order"),
        }

    async def list_todos(self, pagination: TodoPagination) -> list[dict]:
        return await self.repository.find_all(
            paginated=pagination.paginated,
            limit=pagination.limit,
            after_id=pagination.after_id,
        )

    async def get_todo_by_id(self, todo_id: str) -> dict:
        validated_id = self.assert_integer_id(todo_id)
        todo = await self.repository.find_by_id(validated_id)

        if todo is None:
            raise AppError(404, "Todo not found")

        return todo

    async def create_new_todo(self, payload: object) -> dict:
        validated = self.validate_create_payload(payload)

        return await self.repository.create(
            title=validated["title"],
            completed=validated["completed"],
            order=validated["order"],
        )

    async def patch_todo(self, todo_id: str, payload: object) -> dict:
        validated_id = self.assert_integer_id(todo_id)
        validated = self.validate_patch_payload(payload)

        updated = await self.repository.update(
            validated_id,
            has_title=validated["has_title"],
            title=validated["title"],
            has_completed=validated["has_completed"],
            completed=validated["completed"],
            has_order=validated["has_order"],
            order=validated["order"],
        )

        if updated is None:
            raise AppError(404, "Todo not found")

        return updated

    async def remove_todo(self, todo_id: str) -> None:
        validated_id = self.assert_integer_id(todo_id)
        deleted = await self.repository.delete_by_id(validated_id)

        if deleted is None:
            raise AppError(404, "Todo not found")

    async def remove_all_todos(self) -> None:
        await self.repository.delete_all()

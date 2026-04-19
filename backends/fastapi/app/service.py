from .repository import TodoRepository


# Small application-level error type used to return the exact status codes
# and error messages required by the shared backend contract.
class AppError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class TodoService:
    def __init__(self, repository: TodoRepository) -> None:
        self.repository = repository

    # Validate that a route ID is a positive integer.
    # This must behave like the Express implementation.
    @staticmethod
    def assert_integer_id(value: str) -> int:
        try:
            numeric_id = int(value)
        except (TypeError, ValueError) as exc:
            raise AppError(400, "Invalid todo id") from exc

        # Reject values like 0, -1, 1.5, "01", etc.
        if numeric_id <= 0 or str(numeric_id) != str(value):
            raise AppError(400, "Invalid todo id")

        return numeric_id

    # Strict boolean check.
    # bool must be a real boolean, not a string or integer.
    @staticmethod
    def is_boolean(value: object) -> bool:
        return isinstance(value, bool)

    # Strict integer check.
    # bool is excluded because bool is a subclass of int in Python.
    @staticmethod
    def is_integer(value: object) -> bool:
        return isinstance(value, int) and not isinstance(value, bool)

    # Validate the POST request body exactly like Express.
    # Extra fields are accepted and ignored on create.
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

    # Validate the PATCH request body exactly like Express.
    # Unknown fields are rejected on patch.
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

    # Return all todos.
    def list_todos(self) -> list[dict]:
        return self.repository.find_all()

    # Return one todo or 404 if it does not exist.
    def get_todo_by_id(self, todo_id: str) -> dict:
        validated_id = self.assert_integer_id(todo_id)
        todo = self.repository.find_by_id(validated_id)

        if todo is None:
            raise AppError(404, "Todo not found")

        return todo

    # Validate and create one todo.
    def create_new_todo(self, payload: object) -> dict:
        validated = self.validate_create_payload(payload)

        return self.repository.create(
            title=validated["title"],
            completed=validated["completed"],
            order=validated["order"],
        )

    # Validate and partially update one todo.
    def patch_todo(self, todo_id: str, payload: object) -> dict:
        validated_id = self.assert_integer_id(todo_id)
        validated = self.validate_patch_payload(payload)

        updated = self.repository.update(
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

    # Delete one todo or 404 if it does not exist.
    def remove_todo(self, todo_id: str) -> None:
        validated_id = self.assert_integer_id(todo_id)
        deleted = self.repository.delete_by_id(validated_id)

        if deleted is None:
            raise AppError(404, "Todo not found")

    # Delete all todos.
    def remove_all_todos(self) -> None:
        self.repository.delete_all()
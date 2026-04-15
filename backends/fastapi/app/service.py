from .repository import TodoRepository
from .schemas import TodoCreateRequest, TodoPatchRequest


class AppError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class TodoService:
    def __init__(self, repository: TodoRepository) -> None:
        self.repository = repository

    @staticmethod
    def assert_integer_id(value: int) -> int:
        if not isinstance(value, int) or value <= 0:
            raise AppError(400, "Invalid todo id")

        return value

    def list_todos(self) -> list[dict]:
        return self.repository.find_all()

    def get_todo_by_id(self, todo_id: int) -> dict:
        validated_id = self.assert_integer_id(todo_id)
        todo = self.repository.find_by_id(validated_id)

        if todo is None:
            raise AppError(404, "Todo not found")

        return todo

    def create_new_todo(self, payload: TodoCreateRequest) -> dict:
        completed = payload.completed if payload.completed is not None else False

        return self.repository.create(
            title=payload.title,
            completed=completed,
            order=payload.order,
        )

    def patch_todo(self, todo_id: int, payload: TodoPatchRequest) -> dict:
        validated_id = self.assert_integer_id(todo_id)
        fields_set = payload.model_fields_set

        updated = self.repository.update(
            validated_id,
            has_title="title" in fields_set,
            title=payload.title,
            has_completed="completed" in fields_set,
            completed=payload.completed,
            has_order="order" in fields_set,
            order=payload.order,
        )

        if updated is None:
            raise AppError(404, "Todo not found")

        return updated

    def remove_todo(self, todo_id: int) -> None:
        validated_id = self.assert_integer_id(todo_id)
        deleted = self.repository.delete_by_id(validated_id)

        if deleted is None:
            raise AppError(404, "Todo not found")

    def remove_all_todos(self) -> None:
        self.repository.delete_all()
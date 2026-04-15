from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import settings
from .db import close_db_pool, get_pool, open_db_pool
from .repository import TodoRepository
from .schemas import TodoCreateRequest, TodoPatchRequest, TodoResponse
from .service import AppError, TodoService


repository = TodoRepository(get_pool())
service = TodoService(repository)


@asynccontextmanager
async def lifespan(_: FastAPI):
    open_db_pool()
    yield
    close_db_pool()


app = FastAPI(
    title=settings.app_name,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


def to_todo_response(request: Request, row: dict) -> TodoResponse:
    return TodoResponse(
        id=row["id"],
        title=row["title"],
        completed=row["completed"],
        order=row["order"],
        url=str(request.url_for("get_todo_by_id", id=row["id"])),
    )


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.message},
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    has_json_error = any(error.get("type") == "json_invalid" for error in exc.errors())

    return JSONResponse(
        status_code=400,
        content={
            "message": "Invalid JSON body" if has_json_error else "Invalid request"
        },
    )


@app.get("/todos", response_model=list[TodoResponse])
async def get_todos(request: Request) -> list[TodoResponse]:
    todos = service.list_todos()
    return [to_todo_response(request, todo) for todo in todos]


@app.get("/todos/{id}", response_model=TodoResponse, name="get_todo_by_id")
async def get_todo_by_id(id: int, request: Request) -> TodoResponse:
    todo = service.get_todo_by_id(id)
    return to_todo_response(request, todo)


@app.post("/todos", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
async def create_todo(
    payload: TodoCreateRequest,
    request: Request,
    response: Response,
) -> TodoResponse:
    todo = service.create_new_todo(payload)
    response.headers["Location"] = f"/todos/{todo['id']}"
    return to_todo_response(request, todo)


@app.patch("/todos/{id}", response_model=TodoResponse)
async def patch_todo(
    id: int,
    payload: TodoPatchRequest,
    request: Request,
) -> TodoResponse:
    todo = service.patch_todo(id, payload)
    return to_todo_response(request, todo)


@app.delete("/todos/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(id: int) -> Response:
    service.remove_todo(id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.delete("/todos", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todos() -> Response:
    service.remove_all_todos()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
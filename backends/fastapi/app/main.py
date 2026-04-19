import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

from .config import settings
from .db import close_db_pool, get_pool, open_db_pool
from .repository import TodoRepository
from .schemas import TodoResponse
from .service import AppError, TodoService


# Wire repository and service once.
repository = TodoRepository(get_pool())
service = TodoService(repository)


# Open the PostgreSQL pool on startup and close it on shutdown.
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


# Convert one database row into the shared public response shape.
def to_todo_response(request: Request, row: dict) -> TodoResponse:
    return TodoResponse(
        id=row["id"],
        title=row["title"],
        completed=row["completed"],
        order=row["order"],
        url=str(request.url_for("get_todo_by_id", id=str(row["id"]))),
    )


# Parse JSON manually so the service layer controls validation behavior.
async def parse_json_body(request: Request) -> object:
    try:
        return await request.json()
    except json.JSONDecodeError as exc:
        raise AppError(400, "Invalid JSON body") from exc


# Convert known application errors into the shared JSON error format.
@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.message},
    )


# Convert any other unexpected failure into the same generic 500 error shape
# used by Express.
@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    print(exc)

    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error"},
    )


# GET /todos
@app.get("/todos")
async def get_todos(request: Request) -> list[dict]:
    todos = service.list_todos()
    return [to_todo_response(request, todo).model_dump() for todo in todos]


# POST /todos
@app.post("/todos", status_code=status.HTTP_201_CREATED)
async def create_todo(request: Request, response: Response) -> dict:
    payload = await parse_json_body(request)
    todo = service.create_new_todo(payload)

    response.headers["Location"] = f"/todos/{todo['id']}"
    return to_todo_response(request, todo).model_dump()


# DELETE /todos
@app.delete("/todos", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todos() -> Response:
    service.remove_all_todos()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# GET /todos/{id}
# Keep id as string so service-level validation produces the exact Express error.
@app.get("/todos/{id}", name="get_todo_by_id")
async def get_todo_by_id(id: str, request: Request) -> dict:
    todo = service.get_todo_by_id(id)
    return to_todo_response(request, todo).model_dump()


# PATCH /todos/{id}
@app.patch("/todos/{id}")
async def patch_todo(id: str, request: Request) -> dict:
    payload = await parse_json_body(request)
    todo = service.patch_todo(id, payload)
    return to_todo_response(request, todo).model_dump()


# DELETE /todos/{id}
@app.delete("/todos/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_todo(id: str) -> Response:
    service.remove_todo(id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Final fallback route so unmatched paths return the same JSON shape as Express.
@app.api_route("/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"])
async def route_not_found(path: str) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={"message": "Route not found"},
    )
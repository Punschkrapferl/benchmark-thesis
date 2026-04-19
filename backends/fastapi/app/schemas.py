from pydantic import BaseModel, ConfigDict


# Response-only schema.
# Request validation is handled manually in the service layer so FastAPI/Pydantic
# does not introduce framework-specific behavior that differs from Express.
class TodoResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    title: str
    completed: bool
    order: int | None = None
    url: str
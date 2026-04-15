from pydantic import BaseModel, ConfigDict


class TodoCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    completed: bool | None = None
    order: int | None = None


class TodoPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    completed: bool | None = None
    order: int | None = None


class TodoResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    title: str
    completed: bool
    order: int | None = None
    url: str
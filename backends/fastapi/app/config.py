from dataclasses import dataclass
import os


# Read one environment variable as a string.
# If it is missing and no default is provided, fail fast at startup.
def get_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name)

    if value is None or value == "":
        if default is not None:
            return default
        raise RuntimeError(f"Missing required environment variable: {name}")

    return value


# Read one environment variable as an integer.
# This keeps numeric parsing in one place and makes configuration errors explicit.
def get_int_env(name: str, default: int) -> int:
    raw = get_env(name, str(default))

    try:
        return int(raw)
    except ValueError as exc:
        raise RuntimeError(f"Environment variable {name} must be a valid integer") from exc


# Central application settings.
# Keeping all environment-based configuration here avoids scattering os.getenv()
# calls across the rest of the codebase.
@dataclass(frozen=True)
class Settings:
    app_name: str
    port: int
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    db_pool_min_size: int
    db_pool_max_size: int
    db_pool_timeout_seconds: int


settings = Settings(
    app_name=get_env("APP_NAME", "todo-backend-fastapi"),
    port=get_int_env("PORT", 8082),
    db_host=get_env("DB_HOST", "localhost"),
    db_port=get_int_env("DB_PORT", 5432),
    db_name=get_env("DB_NAME", "todo_fastapi"),
    db_user=get_env("DB_USER"),
    db_password=get_env("DB_PASSWORD"),
    db_pool_min_size=get_int_env("DB_POOL_MIN_SIZE", 1),
    db_pool_max_size=get_int_env("DB_POOL_MAX_SIZE", 10),
    db_pool_timeout_seconds=get_int_env("DB_POOL_TIMEOUT_SECONDS", 10),
)
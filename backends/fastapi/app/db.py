from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import settings


# Build the PostgreSQL connection string used by psycopg.
def build_conninfo() -> str:
    return (
        f"host={settings.db_host} "
        f"port={settings.db_port} "
        f"dbname={settings.db_name} "
        f"user={settings.db_user} "
        f"password={settings.db_password}"
    )


# Create one shared connection pool for the whole application.
# The pool is opened during FastAPI startup and closed during shutdown.
pool = ConnectionPool(
    conninfo=build_conninfo(),
    min_size=settings.db_pool_min_size,
    max_size=settings.db_pool_max_size,
    timeout=settings.db_pool_timeout_seconds,
    kwargs={"row_factory": dict_row},
    open=False,
)


# Small accessor used by the repository wiring.
def get_pool() -> ConnectionPool:
    return pool


# Open the pool on startup and verify that PostgreSQL is reachable.
def open_db_pool() -> None:
    pool.open()

    with pool.connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()


# Close the pool during graceful shutdown.
def close_db_pool() -> None:
    pool.close()
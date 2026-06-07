from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import settings


def build_conninfo() -> str:
    return (
        f"host={settings.db_host} "
        f"port={settings.db_port} "
        f"dbname={settings.db_name} "
        f"user={settings.db_user} "
        f"password={settings.db_password}"
    )


pool = AsyncConnectionPool(
    conninfo=build_conninfo(),
    min_size=settings.db_pool_min_size,
    max_size=settings.db_pool_max_size,
    timeout=settings.db_pool_timeout_seconds,
    kwargs={"row_factory": dict_row},
    open=False,
)


def get_pool() -> AsyncConnectionPool:
    return pool


async def open_db_pool() -> None:
    await pool.open()

    async with pool.connection() as connection:
        async with connection.cursor() as cursor:
            await cursor.execute("SELECT 1")
            await cursor.fetchone()


async def close_db_pool() -> None:
    await pool.close()

from psycopg_pool import AsyncConnectionPool


class TodoRepository:
    def __init__(self, pool: AsyncConnectionPool) -> None:
        self.pool = pool

    async def find_all(
        self,
        *,
        paginated: bool,
        limit: int | None,
        after_id: int,
    ) -> list[dict]:
        if not paginated:
            sql = """
                SELECT id, title, completed, "order", created_at
                FROM todos
                ORDER BY id ASC
            """
            params = None
        else:
            sql = """
                SELECT id, title, completed, "order", created_at
                FROM todos
                WHERE id > %(after_id)s
                ORDER BY id ASC
                LIMIT %(limit)s
            """
            params = {"limit": limit, "after_id": after_id}

        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                if params is None:
                    await cursor.execute(sql)
                else:
                    await cursor.execute(sql, params)
                rows = await cursor.fetchall()

        return rows

    async def find_by_id(self, todo_id: int) -> dict | None:
        sql = """
            SELECT id, title, completed, "order", created_at
            FROM todos
            WHERE id = %(id)s
        """

        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql, {"id": todo_id})
                row = await cursor.fetchone()

        return row

    async def create(self, title: str, completed: bool, order: int | None) -> dict:
        sql = """
            INSERT INTO todos (title, completed, "order")
            VALUES (%(title)s, %(completed)s, %(order)s)
            RETURNING id, title, completed, "order", created_at
        """

        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    sql,
                    {
                        "title": title,
                        "completed": completed,
                        "order": order,
                    },
                )
                row = await cursor.fetchone()

        return row

    async def update(
        self,
        todo_id: int,
        *,
        has_title: bool,
        title: str | None,
        has_completed: bool,
        completed: bool | None,
        has_order: bool,
        order: int | None,
    ) -> dict | None:
        sql = """
            UPDATE todos
            SET
                title = CASE
                    WHEN %(has_title)s THEN %(title)s
                    ELSE title
                END,
                completed = CASE
                    WHEN %(has_completed)s THEN %(completed)s
                    ELSE completed
                END,
                "order" = CASE
                    WHEN %(has_order)s THEN %(order)s
                    ELSE "order"
                END
            WHERE id = %(id)s
            RETURNING id, title, completed, "order", created_at
        """

        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    sql,
                    {
                        "id": todo_id,
                        "has_title": has_title,
                        "title": title,
                        "has_completed": has_completed,
                        "completed": completed,
                        "has_order": has_order,
                        "order": order,
                    },
                )
                row = await cursor.fetchone()

        return row

    async def delete_by_id(self, todo_id: int) -> dict | None:
        sql = """
            DELETE FROM todos
            WHERE id = %(id)s
            RETURNING id
        """

        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql, {"id": todo_id})
                row = await cursor.fetchone()

        return row

    async def delete_all(self) -> None:
        sql = """
            DELETE FROM todos
        """

        async with self.pool.connection() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql)

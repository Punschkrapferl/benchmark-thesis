from psycopg_pool import ConnectionPool


class TodoRepository:
    def __init__(self, pool: ConnectionPool) -> None:
        self.pool = pool

    def find_all(self) -> list[dict]:
        sql = """
            SELECT id, title, completed, "order"
            FROM todos
            ORDER BY id ASC
        """

        with self.pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(sql)
                rows = cursor.fetchall()

        return rows

    def find_by_id(self, todo_id: int) -> dict | None:
        sql = """
            SELECT id, title, completed, "order"
            FROM todos
            WHERE id = %(id)s
        """

        with self.pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(sql, {"id": todo_id})
                row = cursor.fetchone()

        return row

    def create(self, title: str, completed: bool, order: int | None) -> dict:
        sql = """
            INSERT INTO todos (title, completed, "order")
            VALUES (%(title)s, %(completed)s, %(order)s)
            RETURNING id, title, completed, "order"
        """

        with self.pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    sql,
                    {
                        "title": title,
                        "completed": completed,
                        "order": order,
                    },
                )
                row = cursor.fetchone()

        return row

    def update(
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
                    WHEN %(has_order)s IS FALSE THEN "order"
                    WHEN %(order)s IS NULL THEN NULL
                    ELSE %(order)s
                END
            WHERE id = %(id)s
            RETURNING id, title, completed, "order"
        """

        with self.pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
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
                row = cursor.fetchone()

        return row

    def delete_by_id(self, todo_id: int) -> dict | None:
        sql = """
            DELETE FROM todos
            WHERE id = %(id)s
            RETURNING id
        """

        with self.pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(sql, {"id": todo_id})
                row = cursor.fetchone()

        return row

    def delete_all(self) -> None:
        sql = """
            DELETE FROM todos
        """

        with self.pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(sql)
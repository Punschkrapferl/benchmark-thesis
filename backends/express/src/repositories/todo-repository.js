import { query } from '../config/database.js';

export async function findAllTodos() {
  const sql = `
    SELECT id, title, completed, "order", created_at
    FROM todos
    ORDER BY id ASC
  `;
  const result = await query(sql);
  return result.rows;
}

export async function findTodoById(id) {
  const sql = `
    SELECT id, title, completed, "order", created_at
    FROM todos
    WHERE id = $1
  `;
  const result = await query(sql, [id]);
  return result.rows[0] ?? null;
}

export async function createTodo({ title, completed, order }) {
  const sql = `
    INSERT INTO todos (title, completed, "order")
    VALUES ($1, $2, $3)
    RETURNING id, title, completed, "order", created_at
  `;

  const result = await query(sql, [title, completed, order]);
  return result.rows[0];
}

export async function updateTodo(id, { title, completed, order }) {
  const sql = `
    UPDATE todos
    SET
      title = COALESCE($2, title),
      completed = COALESCE($3, completed),
      "order" = CASE
        WHEN $4::boolean IS TRUE THEN NULL
        ELSE COALESCE($5, "order")
      END
    WHERE id = $1
    RETURNING id, title, completed, "order", created_at
  `;

  const shouldNullOrder = order === null;
  const orderValue = order === null ? null : order;

  const result = await query(sql, [id, title, completed, shouldNullOrder, orderValue]);
  return result.rows[0] ?? null;
}

export async function deleteTodoById(id) {
  const sql = `
    DELETE FROM todos
    WHERE id = $1
    RETURNING id
  `;
  const result = await query(sql, [id]);
  return result.rows[0] ?? null;
}

export async function deleteAllTodos() {
  const sql = 'DELETE FROM todos';
  await query(sql);
}
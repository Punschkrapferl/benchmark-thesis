import { query } from '../config/database.js';

// Fetch todos ordered by ID.
//
// limit and afterId are optional so the API can still support the original
// unbounded GET /todos behavior for compatibility. The official benchmark
// scenario uses keyset pagination (WHERE id > afterId) so deep pages stay
// O(log n) instead of degrading with table size like OFFSET.
export async function findAllTodos({ limit = null, afterId = 0 } = {}) {
  const hasLimit = Number.isInteger(limit) && limit > 0;

  if (!hasLimit) {
    const sql = `
      SELECT id, title, completed, "order", created_at
      FROM todos
      ORDER BY id ASC
    `;

    const result = await query(sql);
    return result.rows;
  }

  const sql = `
    SELECT id, title, completed, "order", created_at
    FROM todos
    WHERE id > $1
    ORDER BY id ASC
    LIMIT $2
  `;

  const result = await query(sql, [afterId, limit]);
  return result.rows;
}

// Fetch one todo by ID.
export async function findTodoById(id) {
  const sql = `
    SELECT id, title, completed, "order", created_at
    FROM todos
    WHERE id = $1
  `;

  const result = await query(sql, [id]);
  return result.rows[0] ?? null;
}

// Insert a new todo and return the inserted row.
export async function createTodo({ title, completed, order }) {
  const sql = `
    INSERT INTO todos (title, completed, "order")
    VALUES ($1, $2, $3)
    RETURNING id, title, completed, "order", created_at
  `;

  const result = await query(sql, [title, completed, order]);
  return result.rows[0];
}

// Partially update a todo.
//
// COALESCE keeps the old value when a field is not provided.
// The special CASE handles explicit null for "order".
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

// Delete one todo by ID and return the deleted row ID if it existed.
export async function deleteTodoById(id) {
  const sql = `
    DELETE FROM todos
    WHERE id = $1
    RETURNING id
  `;

  const result = await query(sql, [id]);
  return result.rows[0] ?? null;
}

// Delete all todos.
export async function deleteAllTodos() {
  const sql = 'DELETE FROM todos';
  await query(sql);
}
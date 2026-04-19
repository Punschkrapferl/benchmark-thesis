// Build the absolute URL of one todo resource.
// This keeps the response format aligned with the shared backend contract.
function buildTodoUrl(req, id) {
  return `${req.protocol}://${req.get('host')}/todos/${id}`;
}

// Convert one database row into the public API response shape.
export function serializeTodo(req, row) {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    order: row.order,
    url: buildTodoUrl(req, row.id)
  };
}

// Convert multiple rows at once.
export function serializeTodos(req, rows) {
  return rows.map((row) => serializeTodo(req, row));
}
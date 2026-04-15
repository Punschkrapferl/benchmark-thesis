function buildTodoUrl(req, id) {
  return `${req.protocol}://${req.get('host')}/todos/${id}`;
}

export function serializeTodo(req, row) {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    order: row.order,
    url: buildTodoUrl(req, row.id)
  };
}

export function serializeTodos(req, rows) {
  return rows.map((row) => serializeTodo(req, row));
}
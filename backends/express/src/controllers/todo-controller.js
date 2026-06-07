import {
  createNewTodo,
  getTodoById,
  listTodos,
  patchTodo,
  removeAllTodos,
  removeTodo
} from '../services/todo-service.js';
import { serializeTodo, serializeTodos } from '../utils/todo-serializer.js';

// Maximum allowed page size for GET /todos.
//
// This prevents accidental huge collection reads such as:
// /todos?limit=100000
//
// The benchmark scenario currently uses limit=100.
const MAX_TODO_PAGE_LIMIT = 500;

// Default limit used when a client passes an invalid limit but still tries to
// use pagination. Keeping this bounded avoids accidental unbounded behavior.
const DEFAULT_TODO_PAGE_LIMIT = 100;

// Parse a positive integer query parameter.
//
// Express query values arrive as strings. This helper keeps parsing logic in
// one place and avoids passing unsafe values into the SQL LIMIT clause.
function parsePositiveIntegerQueryParam(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }

  return parsed;
}

// Parse a non-negative integer query parameter.
function parseNonNegativeIntegerQueryParam(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallbackValue;
  }

  return parsed;
}

// Build keyset pagination options from query parameters.
//
// Behavior:
// - GET /todos
//   keeps old compatibility behavior and returns all todos.
// - GET /todos?limit=100&afterId=200
//   returns a bounded page of rows whose id is greater than afterId.
//
// Keyset pagination (WHERE id > afterId) keeps deep pages O(log n) instead of
// the O(offset) cost of OFFSET, so read throughput does not degrade with table
// size. This means old API behavior still exists, but the official benchmark
// avoids both the unbounded path and offset scanning.
function buildPaginationOptions(query) {
  const hasLimit = query.limit !== undefined;
  const hasAfterId = query.afterId !== undefined;

  if (!hasLimit && !hasAfterId) {
    return {
      isPaginated: false,
      limit: null,
      afterId: 0
    };
  }

  const requestedLimit = parsePositiveIntegerQueryParam(
    query.limit,
    DEFAULT_TODO_PAGE_LIMIT
  );

  const limit = Math.min(requestedLimit, MAX_TODO_PAGE_LIMIT);

  const afterId = parseNonNegativeIntegerQueryParam(query.afterId, 0);

  return {
    isPaginated: true,
    limit,
    afterId
  };
}

// Controller for GET /todos.
//
// Supports both:
// - unbounded compatibility mode: GET /todos
// - paginated benchmark mode: GET /todos?limit=100&afterId=0
export async function getTodosHandler(req, res, next) {
  try {
    const paginationOptions = buildPaginationOptions(req.query);
    const todos = await listTodos(paginationOptions);

    res.status(200).json(serializeTodos(req, todos));
  } catch (error) {
    next(error);
  }
}

// Controller for GET /todos/:id.
// Fetches a single todo by ID.
export async function getTodoByIdHandler(req, res, next) {
  try {
    const todo = await getTodoById(req.params.id);
    res.status(200).json(serializeTodo(req, todo));
  } catch (error) {
    next(error);
  }
}

// Controller for POST /todos.
// Creates a new todo from the JSON body.
export async function createTodoHandler(req, res, next) {
  try {
    const todo = await createNewTodo(req.body);

    res
      .location(`/todos/${todo.id}`)
      .status(201)
      .json(serializeTodo(req, todo));
  } catch (error) {
    next(error);
  }
}

// Controller for PATCH /todos/:id.
// Applies a partial update to an existing todo.
export async function patchTodoHandler(req, res, next) {
  try {
    const todo = await patchTodo(req.params.id, req.body);
    res.status(200).json(serializeTodo(req, todo));
  } catch (error) {
    next(error);
  }
}

// Controller for DELETE /todos/:id.
// Deletes one todo.
export async function deleteTodoHandler(req, res, next) {
  try {
    await removeTodo(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Controller for DELETE /todos.
// Deletes all todos.
export async function deleteTodosHandler(req, res, next) {
  try {
    await removeAllTodos();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
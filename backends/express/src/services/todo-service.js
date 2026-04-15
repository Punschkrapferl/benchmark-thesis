import {
  createTodo,
  deleteAllTodos,
  deleteTodoById,
  findAllTodos,
  findTodoById,
  updateTodo
} from '../repositories/todo-repository.js';

class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

function assertIntegerId(id) {
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError(400, 'Invalid todo id');
  }

  return numericId;
}

function isBoolean(value) {
  return typeof value === 'boolean';
}

function isInteger(value) {
  return Number.isInteger(value);
}

function validateCreatePayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError(400, 'Request body must be a JSON object');
  }

  if (typeof payload.title !== 'string') {
    throw new AppError(400, 'Field "title" is required and must be a string');
  }

  if (payload.completed !== undefined && !isBoolean(payload.completed)) {
    throw new AppError(400, 'Field "completed" must be a boolean');
  }

  if (
    payload.order !== undefined &&
    payload.order !== null &&
    !isInteger(payload.order)
  ) {
    throw new AppError(400, 'Field "order" must be an integer or null');
  }

  return {
    title: payload.title,
    completed: payload.completed ?? false,
    order: payload.order ?? null
  };
}

function validatePatchPayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError(400, 'Request body must be a JSON object');
  }

  const allowedKeys = new Set(['title', 'completed', 'order']);

  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      throw new AppError(400, `Unknown field "${key}"`);
    }
  }

  if (payload.title !== undefined && typeof payload.title !== 'string') {
    throw new AppError(400, 'Field "title" must be a string');
  }

  if (payload.completed !== undefined && !isBoolean(payload.completed)) {
    throw new AppError(400, 'Field "completed" must be a boolean');
  }

  if (
    payload.order !== undefined &&
    payload.order !== null &&
    !isInteger(payload.order)
  ) {
    throw new AppError(400, 'Field "order" must be an integer or null');
  }

  return {
    title: payload.title,
    completed: payload.completed,
    order: payload.order
  };
}

export async function listTodos() {
  return findAllTodos();
}

export async function getTodoById(id) {
  const todoId = assertIntegerId(id);
  const todo = await findTodoById(todoId);

  if (!todo) {
    throw new AppError(404, 'Todo not found');
  }

  return todo;
}

export async function createNewTodo(payload) {
  const validated = validateCreatePayload(payload);
  return createTodo(validated);
}

export async function patchTodo(id, payload) {
  const todoId = assertIntegerId(id);
  const validated = validatePatchPayload(payload);
  const updated = await updateTodo(todoId, validated);

  if (!updated) {
    throw new AppError(404, 'Todo not found');
  }

  return updated;
}

export async function removeTodo(id) {
  const todoId = assertIntegerId(id);
  const deleted = await deleteTodoById(todoId);

  if (!deleted) {
    throw new AppError(404, 'Todo not found');
  }
}

export async function removeAllTodos() {
  await deleteAllTodos();
}

export { AppError };
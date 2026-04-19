import {
  createNewTodo,
  getTodoById,
  listTodos,
  patchTodo,
  removeAllTodos,
  removeTodo
} from '../services/todo-service.js';
import { serializeTodo, serializeTodos } from '../utils/todo-serializer.js';

// Controller for GET /todos
// Fetches all todos and returns them in the common API response format.
export async function getTodosHandler(req, res, next) {
  try {
    const todos = await listTodos();
    res.status(200).json(serializeTodos(req, todos));
  } catch (error) {
    next(error);
  }
}

// Controller for GET /todos/:id
// Fetches a single todo by ID.
export async function getTodoByIdHandler(req, res, next) {
  try {
    const todo = await getTodoById(req.params.id);
    res.status(200).json(serializeTodo(req, todo));
  } catch (error) {
    next(error);
  }
}

// Controller for POST /todos
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

// Controller for PATCH /todos/:id
// Applies a partial update to an existing todo.
export async function patchTodoHandler(req, res, next) {
  try {
    const todo = await patchTodo(req.params.id, req.body);
    res.status(200).json(serializeTodo(req, todo));
  } catch (error) {
    next(error);
  }
}

// Controller for DELETE /todos/:id
// Deletes one todo.
export async function deleteTodoHandler(req, res, next) {
  try {
    await removeTodo(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Controller for DELETE /todos
// Deletes all todos.
export async function deleteTodosHandler(req, res, next) {
  try {
    await removeAllTodos();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
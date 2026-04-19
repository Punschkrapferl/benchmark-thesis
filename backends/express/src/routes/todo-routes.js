import { Router } from 'express';
import {
  createTodoHandler,
  deleteTodoHandler,
  deleteTodosHandler,
  getTodoByIdHandler,
  getTodosHandler,
  patchTodoHandler
} from '../controllers/todo-controller.js';

const router = Router();

// Route definitions for the Todo API.
// Each route delegates to a controller function.
router.get('/todos', getTodosHandler);
router.post('/todos', createTodoHandler);
router.get('/todos/:id', getTodoByIdHandler);
router.patch('/todos/:id', patchTodoHandler);
router.delete('/todos/:id', deleteTodoHandler);
router.delete('/todos', deleteTodosHandler);

export default router;
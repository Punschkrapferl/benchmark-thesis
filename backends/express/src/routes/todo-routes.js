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

router.get('/todos', getTodosHandler);
router.post('/todos', createTodoHandler);
router.get('/todos/:id', getTodoByIdHandler);
router.patch('/todos/:id', patchTodoHandler);
router.delete('/todos/:id', deleteTodoHandler);
router.delete('/todos', deleteTodosHandler);

export default router;
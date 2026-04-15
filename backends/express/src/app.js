import express from 'express';
import todoRoutes from './routes/todo-routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';

const app = express();

app.set('etag', false);
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(express.json({
  limit: '1mb'
}));

app.use(todoRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
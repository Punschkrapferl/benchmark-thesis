import express from 'express';
import todoRoutes from './routes/todo-routes.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';

const app = express();

// Disable response ETags so caching does not influence benchmark behavior.
app.set('etag', false);

// Hide framework identification header.
app.disable('x-powered-by');

// Trust reverse proxy headers if the app is run behind a proxy/container setup.
app.set('trust proxy', true);

// Parse JSON request bodies up to 1 MB.
app.use(express.json({
  limit: '1mb'
}));

// Register the Todo API routes.
app.use(todoRoutes);

// Fallback handlers.
// First unmatched route handling, then centralized error handling.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
import { AppError } from '../services/todo-service.js';

// Central error handler for all uncaught request errors.
// Converts internal errors into consistent HTTP responses.
export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  // Handle malformed JSON bodies sent to express.json().
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      message: 'Invalid JSON body'
    });
  }

  // Handle expected application-level validation or not-found errors.
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message
    });
  }

  // Log unexpected internal failures and return a generic 500 response.
  console.error(error);

  return res.status(500).json({
    message: 'Internal server error'
  });
}
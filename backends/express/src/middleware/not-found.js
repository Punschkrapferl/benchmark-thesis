// Fallback middleware for routes that do not exist.
export function notFoundHandler(req, res) {
  res.status(404).json({
    message: 'Route not found'
  });
}
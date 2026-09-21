// Global Error Handler Middleware
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.status >= 400 && err.status < 600 ? err.status : 500);
  const errorTitle = err.error || (statusCode >= 500 ? 'Internal Server Error' : 'Validation Error');
  const message = err.message || 'An unexpected error occurred.';

  res.status(statusCode).json({
    error: errorTitle,
    message: message,
  });
}

module.exports = errorHandler;

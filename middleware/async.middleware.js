/**
 * Wrapper for async route handlers to avoid try-catch blocks
 * @param {Function} fn - Async route handler function
 * @returns {Function} - Wrapped middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  // Ensure the function returns a Promise
  Promise.resolve(fn(req, res, next)).catch((err) => {
    // Enhanced error logging
    console.error(`[AsyncHandler] Error in ${req.method} ${req.originalUrl}:`, err);
    
    // If the error doesn't have a statusCode, default to 500
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    
    // Pass to Express error handler
    next(err);
  });
};

module.exports = asyncHandler;
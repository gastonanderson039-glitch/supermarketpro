class ErrorResponse extends Error {
  /**
   * Create custom ErrorResponse
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguish expected errors from programming errors

    // Capture stack trace (excluding constructor call)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Create a not found error
   * @param {string} resource - Name of the resource not found
   * @returns {ErrorResponse} - 404 Not Found error
   */
  static notFound(resource) {
    return new ErrorResponse(`${resource} not found`, 404);
  }

  /**
   * Create an unauthorized error
   * @param {string} [message] - Custom message
   * @returns {ErrorResponse} - 401 Unauthorized error
   */
  static unauthorized(message = 'Not authorized to access this resource') {
    return new ErrorResponse(message, 401);
  }

  /**
   * Create a bad request error
   * @param {string} [message] - Custom message
   * @returns {ErrorResponse} - 400 Bad Request error
   */
  static badRequest(message = 'Invalid request data') {
    return new ErrorResponse(message, 400);
  }
}

module.exports = ErrorResponse;
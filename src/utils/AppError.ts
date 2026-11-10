/** Any error a route handler throws deliberately (bad input, not found,
 *  unauthorized) extends this, so the central error handler
 *  (src/middleware/errorHandler.ts) can tell "expected, safe-to-show-the-
 *  client" errors apart from genuine bugs/crashes (whose details should
 *  never reach the client in production). */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "ERROR",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that") {
    super(403, message, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, "CONFLICT");
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(422, "Validation failed", "VALIDATION_ERROR", details);
  }
}

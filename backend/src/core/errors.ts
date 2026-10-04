/** Errors the API turns into HTTP responses. */

export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code = "app_error",
  ) {
    super(message);
    this.name = new.target.name;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, "bad_request");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Not allowed") {
    super(message, 403, "forbidden");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "not_found");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "conflict");
  }
}

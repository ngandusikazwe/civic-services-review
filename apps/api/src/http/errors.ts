export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function badRequest(
  message: string,
  details?: unknown,
  code = "BAD_REQUEST"
): HttpError {
  return new HttpError(400, code, message, details);
}

export function unauthorized(message = "Authentication is required."): HttpError {
  return new HttpError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "You are not allowed to perform this action."): HttpError {
  return new HttpError(403, "FORBIDDEN", message);
}

export function notFound(message = "Resource not found."): HttpError {
  return new HttpError(404, "NOT_FOUND", message);
}

export function conflict(message: string, code = "CONFLICT"): HttpError {
  return new HttpError(409, code, message);
}

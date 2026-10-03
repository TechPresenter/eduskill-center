export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "ERROR",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const Errors = {
  badRequest: (message = "Bad request", details?: unknown) => new ApiError(400, message, "BAD_REQUEST", details),
  unauthorized: (message = "Authentication required") => new ApiError(401, message, "UNAUTHORIZED"),
  /**
   * No (valid) session at all. Kept distinct from `unauthorized`, which services also use for a
   * wrong code or password: only this code tells the client its session has ended.
   */
  sessionRequired: () => new ApiError(401, "Authentication required", "SESSION_REQUIRED"),
  forbidden: (message = "You do not have permission to perform this action") =>
    new ApiError(403, message, "FORBIDDEN"),
  notFound: (what = "Resource") => new ApiError(404, `${what} not found`, "NOT_FOUND"),
  conflict: (message = "Conflict", details?: unknown) => new ApiError(409, message, "CONFLICT", details),
  validation: (message = "Validation failed", details?: unknown) =>
    new ApiError(422, message, "VALIDATION_ERROR", details),
  tooMany: (retryAfterSec: number) =>
    new ApiError(429, "Too many requests. Please try again later.", "RATE_LIMITED", { retryAfterSec }),
  internal: (message = "Something went wrong") => new ApiError(500, message, "INTERNAL_ERROR"),
};

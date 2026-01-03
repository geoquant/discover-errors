/**
 * Cloudflare API error classes with discriminated union support.
 * 
 * Errors are designed to distinguish between:
 * - Known errors (defined in advance)
 * - Unknown errors (discovered during exploration)
 */

import { Data } from "effect";
import type { CloudflareApiError } from "./types.ts";

/**
 * Base class for all Cloudflare errors.
 * Uses Effect's Data.TaggedError for discriminated unions.
 */
export class CloudflareError extends Data.TaggedError("CloudflareError")<{
  code: number;
  message: string;
  httpStatus?: number;
}> {}

/**
 * Error for newly discovered/undocumented Cloudflare API errors.
 * This is used when the error code is not recognized.
 */
export class UnknownCloudflareError extends Data.TaggedError(
  "UnknownCloudflareError"
)<{
  code: number;
  message: string;
  httpStatus?: number;
  rawError: CloudflareApiError;
}> {}

/**
 * Authentication/authorization errors.
 */
export class AuthenticationError extends Data.TaggedError(
  "AuthenticationError"
)<{
  code: number;
  message: string;
  httpStatus?: number;
}> {}

/**
 * Rate limiting errors (HTTP 429).
 */
export class RateLimitError extends Data.TaggedError("RateLimitError")<{
  code: number;
  message: string;
  httpStatus?: number;
  retryAfter?: number;
}> {}

/**
 * Resource not found errors (HTTP 404).
 */
export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  code: number;
  message: string;
  httpStatus?: number;
  resourceType?: string;
}> {}

/**
 * Validation errors (HTTP 400).
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  code: number;
  message: string;
  httpStatus?: number;
  field?: string;
}> {}

/**
 * Quota/limit exceeded errors (HTTP 403 or 429).
 */
export class QuotaExceededError extends Data.TaggedError("QuotaExceededError")<{
  code: number;
  message: string;
  httpStatus?: number;
  quotaType?: string;
}> {}

/**
 * Resource already exists errors (HTTP 409).
 */
export class AlreadyExistsError extends Data.TaggedError("AlreadyExistsError")<{
  code: number;
  message: string;
  httpStatus?: number;
  resourceType?: string;
}> {}

/**
 * Network/HTTP errors (not from Cloudflare API response).
 */
export class HttpError extends Data.TaggedError("HttpError")<{
  statusCode: number;
  statusText: string;
  message: string;
}> {}

/**
 * JSON parsing errors.
 */
export class ParseError extends Data.TaggedError("ParseError")<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Union type of all possible Cloudflare errors.
 */
export type CloudflareErrorType =
  | CloudflareError
  | UnknownCloudflareError
  | AuthenticationError
  | RateLimitError
  | NotFoundError
  | ValidationError
  | QuotaExceededError
  | AlreadyExistsError
  | HttpError
  | ParseError;

/**
 * Common Cloudflare error codes mapped to error classes.
 * This is used to classify errors into known categories.
 */
export const COMMON_ERROR_CODES: Record<
  number,
  new (props: { code: number; message: string; httpStatus?: number }) => CloudflareErrorType
> = {
  // Authentication errors (9xxx range)
  9103: AuthenticationError, // Invalid API token
  9109: AuthenticationError, // Missing API token
  9106: AuthenticationError, // Forbidden
  
  // Rate limiting (6xxx range)
  6003: RateLimitError, // Rate limit exceeded
  
  // Validation errors (1xxx range)
  1001: ValidationError, // Invalid request
  1004: ValidationError, // Missing required parameter
  1006: ValidationError, // Invalid parameter value
  
  // Not found (10xxx range - varies by service)
  10000: NotFoundError, // Resource not found (generic)
};

/**
 * Map HTTP status codes to error classes when API doesn't provide error code.
 */
export const HTTP_STATUS_TO_ERROR: Record<
  number,
  new (props: any) => CloudflareErrorType
> = {
  400: ValidationError,
  401: AuthenticationError,
  403: AuthenticationError,
  404: NotFoundError,
  409: AlreadyExistsError,
  429: RateLimitError,
};

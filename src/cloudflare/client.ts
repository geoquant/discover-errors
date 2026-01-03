/**
 * Cloudflare API HTTP client with Effect.
 * 
 * Provides:
 * - Base HTTP client with authentication
 * - Error response parsing and classification
 * - Retry logic for rate limits
 * - Type-safe request/response handling
 */

import { Effect, Schedule } from "effect";
import type { CloudflareResponse } from "./types.ts";
import {
  CloudflareCredentials,
  CloudflareConfig,
  defaultCloudflareConfig,
} from "./types.ts";
import {
  CloudflareError,
  UnknownCloudflareError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
  AlreadyExistsError,
  HttpError,
  ParseError,
  COMMON_ERROR_CODES,
  HTTP_STATUS_TO_ERROR,
  type CloudflareErrorType,
} from "./errors.ts";

/**
 * Parse a Cloudflare API error response into a typed error.
 */
export const parseCloudflareError = (
  response: CloudflareResponse<unknown>,
  httpStatus?: number
): CloudflareErrorType => {
  // If no errors array, create a generic error
  if (!response.errors || response.errors.length === 0) {
    return new CloudflareError({
      code: 0,
      message: "Unknown error: API returned success=false but no error details",
      httpStatus,
    });
  }

  // Get the first error (primary error)
  const primaryError = response.errors[0];
  const code = primaryError?.code ?? 0;
  const message = primaryError?.message ?? "Unknown error";

  // Try to match against known error codes
  const ErrorClass = COMMON_ERROR_CODES[code];
  if (ErrorClass) {
    return new ErrorClass({ code, message, httpStatus });
  }

  // Try to infer from HTTP status code
  if (httpStatus && HTTP_STATUS_TO_ERROR[httpStatus]) {
    const StatusErrorClass = HTTP_STATUS_TO_ERROR[httpStatus];
    return new StatusErrorClass({ code, message, httpStatus });
  }

  // Unknown error - this is what we're trying to discover!
  return new UnknownCloudflareError({
    code,
    message,
    httpStatus,
    rawError: primaryError!,
  });
};

/**
 * Make an HTTP request to the Cloudflare API.
 * 
 * This is the core function that:
 * 1. Injects authentication headers
 * 2. Constructs the full URL
 * 3. Executes the request
 * 4. Parses the response
 * 5. Handles errors with retry logic
 */
export const makeRequest = <T>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  options?: {
    body?: unknown;
    query?: Record<string, string>;
    headers?: Record<string, string>;
  }
): Effect.Effect<T, CloudflareErrorType, CloudflareCredentials | CloudflareConfig> =>
  Effect.gen(function* () {
    // Get dependencies
    const credentials = yield* CloudflareCredentials;
    const config = yield* Effect.orElseSucceed(
      CloudflareConfig,
      () => defaultCloudflareConfig
    );

    // Construct URL - ensure baseUrl path is preserved
    const url = new URL(config.baseUrl + path);
    if (options?.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    // Prepare headers
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${credentials.apiToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    };

    // Prepare request options
    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (options?.body) {
      requestInit.body = JSON.stringify(options.body);
    }

    // Execute request with retry logic for rate limits
    const response = yield* Effect.tryPromise({
      try: () => fetch(url.toString(), requestInit),
      catch: (error) =>
        new HttpError({
          statusCode: 0,
          statusText: "Network Error",
          message: error instanceof Error ? error.message : "Unknown network error",
        }),
    }).pipe(
      Effect.retry(
        Schedule.exponential(config.retryDelayMs).pipe(
          Schedule.compose(Schedule.recurs(config.retryAttempts)),
          Schedule.whileInput((error: CloudflareErrorType) =>
            error._tag === "RateLimitError"
          )
        )
      )
    );

    // Check HTTP status
    if (!response.ok) {
      // Try to parse error response
      const errorBody = yield* Effect.tryPromise({
        try: () => response.json() as Promise<CloudflareResponse<unknown>>,
        catch: () =>
          new ParseError({
            message: `Failed to parse error response: ${response.statusText}`,
          }),
      });

      // Parse and throw typed error
      yield* Effect.fail(parseCloudflareError(errorBody, response.status));
    }

    // Parse success response
    const data = yield* Effect.tryPromise({
      try: () => response.json() as Promise<CloudflareResponse<T>>,
      catch: (error) =>
        new ParseError({
          message: "Failed to parse response body",
          cause: error,
        }),
    });

    // Check Cloudflare's success field
    if (!data.success) {
      yield* Effect.fail(parseCloudflareError(data, response.status));
    }

    // Return the result
    if (data.result === null) {
      yield* Effect.fail(
        new CloudflareError({
          code: 0,
          message: "API returned success=true but result is null",
          httpStatus: response.status,
        })
      );
    }

    return data.result as T;
  });

/**
 * Helper: GET request
 */
export const get = <T>(
  path: string,
  options?: { query?: Record<string, string>; headers?: Record<string, string> }
): Effect.Effect<T, CloudflareErrorType, CloudflareCredentials | CloudflareConfig> =>
  makeRequest<T>("GET", path, options);

/**
 * Helper: POST request
 */
export const post = <T>(
  path: string,
  body?: unknown,
  options?: { query?: Record<string, string>; headers?: Record<string, string> }
): Effect.Effect<T, CloudflareErrorType, CloudflareCredentials | CloudflareConfig> =>
  makeRequest<T>("POST", path, { ...options, body });

/**
 * Helper: PUT request
 */
export const put = <T>(
  path: string,
  body?: unknown,
  options?: { query?: Record<string, string>; headers?: Record<string, string> }
): Effect.Effect<T, CloudflareErrorType, CloudflareCredentials | CloudflareConfig> =>
  makeRequest<T>("PUT", path, { ...options, body });

/**
 * Helper: DELETE request
 */
export const del = <T>(
  path: string,
  options?: { query?: Record<string, string>; headers?: Record<string, string> }
): Effect.Effect<T, CloudflareErrorType, CloudflareCredentials | CloudflareConfig> =>
  makeRequest<T>("DELETE", path, options);

/**
 * Helper: PATCH request
 */
export const patch = <T>(
  path: string,
  body?: unknown,
  options?: { query?: Record<string, string>; headers?: Record<string, string> }
): Effect.Effect<T, CloudflareErrorType, CloudflareCredentials | CloudflareConfig> =>
  makeRequest<T>("PATCH", path, { ...options, body });

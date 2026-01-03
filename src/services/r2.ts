/**
 * R2 (Object Storage) service operations.
 * 
 * Provides type-safe operations for:
 * - Listing buckets
 * - Creating buckets
 * - Deleting buckets
 * - Getting bucket info
 */

import * as S from "effect/Schema";
import { Effect } from "effect";
import { get, post, del } from "../cloudflare/client.ts";
import { CloudflareAccountId, CloudflareCredentials, CloudflareConfig } from "../cloudflare/types.ts";
import type { CloudflareErrorType } from "../cloudflare/errors.ts";

/**
 * Operation type with input schema and known errors metadata.
 */
type Operation<I, O, E extends CloudflareErrorType = CloudflareErrorType> = {
  (input: I): Effect.Effect<O, E, CloudflareAccountId | CloudflareCredentials | CloudflareConfig>;
  input: S.Schema<I, I, never>;
  errors: ReadonlyArray<{ _tag: string }>;
};

// ============================================================================
// Schemas
// ============================================================================

/**
 * R2 Bucket schema
 */
const Bucket = S.Struct({
  name: S.String,
  creation_date: S.String,
});

/**
 * List buckets input (no parameters needed)
 */
const ListBucketsInput = S.Struct({});

/**
 * List buckets output
 */
const ListBucketsOutput = S.Struct({
  buckets: S.Array(Bucket),
});

/**
 * Create bucket input
 */
const CreateBucketInput = S.Struct({
  name: S.String,
  locationHint: S.optional(S.String),
});

/**
 * Create bucket output
 */
const CreateBucketOutput = Bucket;

/**
 * Delete bucket input
 */
const DeleteBucketInput = S.Struct({
  name: S.String,
});

/**
 * Delete bucket output (empty response on success)
 */
const DeleteBucketOutput = S.Struct({});

/**
 * Get bucket input
 */
const GetBucketInput = S.Struct({
  name: S.String,
});

/**
 * Get bucket output
 */
const GetBucketOutput = Bucket;

// ============================================================================
// Known Errors
// ============================================================================

const listBucketsErrors = [
  { _tag: "AuthenticationError" as const },
  { _tag: "RateLimitError" as const },
];

const createBucketErrors = [
  { _tag: "AuthenticationError" as const },
  { _tag: "ValidationError" as const },
  { _tag: "AlreadyExistsError" as const },
  { _tag: "QuotaExceededError" as const },
  { _tag: "RateLimitError" as const },
];

const deleteBucketErrors = [
  { _tag: "AuthenticationError" as const },
  { _tag: "NotFoundError" as const },
  { _tag: "RateLimitError" as const },
];

const getBucketErrors = [
  { _tag: "AuthenticationError" as const },
  { _tag: "NotFoundError" as const },
  { _tag: "RateLimitError" as const },
];

// ============================================================================
// Operations
// ============================================================================

/**
 * List all R2 buckets in the account.
 */
export const listBuckets: Operation<
  typeof ListBucketsInput.Type,
  typeof ListBucketsOutput.Type
> = Object.assign(
  (input: typeof ListBucketsInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* get<typeof ListBucketsOutput.Type>(
        `/accounts/${accountId}/r2/buckets`
      );
    }),
  {
    input: ListBucketsInput,
    errors: listBucketsErrors,
  }
);

/**
 * Create a new R2 bucket.
 */
export const createBucket: Operation<
  typeof CreateBucketInput.Type,
  typeof CreateBucketOutput.Type
> = Object.assign(
  (input: typeof CreateBucketInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      
      const body: Record<string, unknown> = {
        name: input.name,
      };
      
      if (input.locationHint) {
        body.locationHint = input.locationHint;
      }
      
      return yield* post<typeof CreateBucketOutput.Type>(
        `/accounts/${accountId}/r2/buckets`,
        body
      );
    }),
  {
    input: CreateBucketInput,
    errors: createBucketErrors,
  }
);

/**
 * Delete an R2 bucket.
 */
export const deleteBucket: Operation<
  typeof DeleteBucketInput.Type,
  typeof DeleteBucketOutput.Type
> = Object.assign(
  (input: typeof DeleteBucketInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* del<typeof DeleteBucketOutput.Type>(
        `/accounts/${accountId}/r2/buckets/${input.name}`
      );
    }),
  {
    input: DeleteBucketInput,
    errors: deleteBucketErrors,
  }
);

/**
 * Get information about a specific R2 bucket.
 */
export const getBucket: Operation<
  typeof GetBucketInput.Type,
  typeof GetBucketOutput.Type
> = Object.assign(
  (input: typeof GetBucketInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* get<typeof GetBucketOutput.Type>(
        `/accounts/${accountId}/r2/buckets/${input.name}`
      );
    }),
  {
    input: GetBucketInput,
    errors: getBucketErrors,
  }
);

/**
 * Cloudflare KV (Key-Value) API service operations.
 * 
 * Provides Effect-based operations for:
 * - Managing KV namespaces (list, create, delete)
 * - Managing KV keys and values (list, get, put, delete)
 * 
 * Each operation includes:
 * - Input/output schemas (Effect Schema)
 * - Known error types for error handling
 * - Type-safe Effect-based implementation
 */

import * as S from "effect/Schema";
import { Effect } from "effect";
import { get, post, put, del } from "../cloudflare/client.ts";
import { CloudflareAccountId, CloudflareCredentials, CloudflareConfig } from "../cloudflare/types.ts";
import type { CloudflareErrorType } from "../cloudflare/errors.ts";

/**
 * Operation type with metadata.
 * Includes the Effect function, input schema, and known errors.
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
 * KV namespace metadata returned by the API.
 */
const KVNamespace = S.Struct({
  id: S.String,
  title: S.String,
  supports_url_encoding: S.optional(S.Boolean),
});

/**
 * KV key metadata returned when listing keys.
 */
const KVKey = S.Struct({
  name: S.String,
  expiration: S.optional(S.Number),
  metadata: S.optional(S.Unknown),
});

/**
 * List namespaces input (no parameters required).
 */
const ListNamespacesInput = S.Struct({});

/**
 * List namespaces output.
 */
const ListNamespacesOutput = S.Array(KVNamespace);

/**
 * Create namespace input.
 */
const CreateNamespaceInput = S.Struct({
  title: S.String,
});

/**
 * Create namespace output.
 */
const CreateNamespaceOutput = KVNamespace;

/**
 * Delete namespace input.
 */
const DeleteNamespaceInput = S.Struct({
  namespaceId: S.String,
});

/**
 * Delete namespace output (null on success).
 */
const DeleteNamespaceOutput = S.Null;

/**
 * List keys input.
 */
const ListKeysInput = S.Struct({
  namespaceId: S.String,
  prefix: S.optional(S.String),
  limit: S.optional(S.Number),
  cursor: S.optional(S.String),
});

/**
 * List keys output.
 */
const ListKeysOutput = S.Struct({
  result: S.Array(KVKey),
  result_info: S.Struct({
    count: S.Number,
    cursor: S.optional(S.String),
  }),
});

/**
 * Get value input.
 */
const GetValueInput = S.Struct({
  namespaceId: S.String,
  keyName: S.String,
});

/**
 * Get value output (string value).
 */
const GetValueOutput = S.String;

/**
 * Put value input.
 */
const PutValueInput = S.Struct({
  namespaceId: S.String,
  keyName: S.String,
  value: S.String,
  expiration: S.optional(S.Number),
  expiration_ttl: S.optional(S.Number),
  metadata: S.optional(S.Unknown),
});

/**
 * Put value output (null on success).
 */
const PutValueOutput = S.Null;

/**
 * Delete value input.
 */
const DeleteValueInput = S.Struct({
  namespaceId: S.String,
  keyName: S.String,
});

/**
 * Delete value output (null on success).
 */
const DeleteValueOutput = S.Null;

// ============================================================================
// Namespace Operations
// ============================================================================

/**
 * List all KV namespaces in the account.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - RateLimitError: Too many requests
 */
export const listNamespaces: Operation<
  typeof ListNamespacesInput.Type,
  typeof ListNamespacesOutput.Type
> = Object.assign(
  (input: typeof ListNamespacesInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* get<typeof ListNamespacesOutput.Type>(
        `/accounts/${accountId}/storage/kv/namespaces`
      );
    }),
  {
    input: ListNamespacesInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

/**
 * Create a new KV namespace.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - ValidationError: Invalid namespace title
 * - AlreadyExistsError: Namespace with this title already exists
 * - QuotaExceededError: Account has reached namespace limit
 * - RateLimitError: Too many requests
 */
export const createNamespace: Operation<
  typeof CreateNamespaceInput.Type,
  typeof CreateNamespaceOutput.Type
> = Object.assign(
  (input: typeof CreateNamespaceInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* post<typeof CreateNamespaceOutput.Type>(
        `/accounts/${accountId}/storage/kv/namespaces`,
        input
      );
    }),
  {
    input: CreateNamespaceInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "ValidationError" as const },
      { _tag: "AlreadyExistsError" as const },
      { _tag: "QuotaExceededError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

/**
 * Delete a KV namespace.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - NotFoundError: Namespace does not exist
 * - RateLimitError: Too many requests
 */
export const deleteNamespace: Operation<
  typeof DeleteNamespaceInput.Type,
  typeof DeleteNamespaceOutput.Type
> = Object.assign(
  (input: typeof DeleteNamespaceInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* del<typeof DeleteNamespaceOutput.Type>(
        `/accounts/${accountId}/storage/kv/namespaces/${input.namespaceId}`
      );
    }),
  {
    input: DeleteNamespaceInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "NotFoundError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

// ============================================================================
// Key-Value Operations
// ============================================================================

/**
 * List keys in a KV namespace.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - NotFoundError: Namespace does not exist
 * - RateLimitError: Too many requests
 */
export const listKeys: Operation<
  typeof ListKeysInput.Type,
  typeof ListKeysOutput.Type
> = Object.assign(
  (input: typeof ListKeysInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      
      // Build query parameters
      const query: Record<string, string> = {};
      if (input.prefix) query.prefix = input.prefix;
      if (input.limit) query.limit = input.limit.toString();
      if (input.cursor) query.cursor = input.cursor;
      
      return yield* get<typeof ListKeysOutput.Type>(
        `/accounts/${accountId}/storage/kv/namespaces/${input.namespaceId}/keys`,
        { query }
      );
    }),
  {
    input: ListKeysInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "NotFoundError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

/**
 * Get a value from KV storage.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - NotFoundError: Namespace or key does not exist
 * - RateLimitError: Too many requests
 */
export const getValue: Operation<
  typeof GetValueInput.Type,
  typeof GetValueOutput.Type
> = Object.assign(
  (input: typeof GetValueInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* get<typeof GetValueOutput.Type>(
        `/accounts/${accountId}/storage/kv/namespaces/${input.namespaceId}/values/${input.keyName}`
      );
    }),
  {
    input: GetValueInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "NotFoundError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

/**
 * Put a value into KV storage.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - NotFoundError: Namespace does not exist
 * - ValidationError: Invalid key name or value
 * - QuotaExceededError: Storage quota exceeded
 * - RateLimitError: Too many requests
 */
export const putValue: Operation<
  typeof PutValueInput.Type,
  typeof PutValueOutput.Type
> = Object.assign(
  (input: typeof PutValueInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      
      // Build query parameters for metadata
      const query: Record<string, string> = {};
      if (input.expiration) query.expiration = input.expiration.toString();
      if (input.expiration_ttl) query.expiration_ttl = input.expiration_ttl.toString();
      if (input.metadata) query.metadata = JSON.stringify(input.metadata);
      
      return yield* put<typeof PutValueOutput.Type>(
        `/accounts/${accountId}/storage/kv/namespaces/${input.namespaceId}/values/${input.keyName}`,
        input.value,
        { query }
      );
    }),
  {
    input: PutValueInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "NotFoundError" as const },
      { _tag: "ValidationError" as const },
      { _tag: "QuotaExceededError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

/**
 * Delete a value from KV storage.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - NotFoundError: Namespace or key does not exist
 * - RateLimitError: Too many requests
 */
export const deleteValue: Operation<
  typeof DeleteValueInput.Type,
  typeof DeleteValueOutput.Type
> = Object.assign(
  (input: typeof DeleteValueInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* del<typeof DeleteValueOutput.Type>(
        `/accounts/${accountId}/storage/kv/namespaces/${input.namespaceId}/values/${input.keyName}`
      );
    }),
  {
    input: DeleteValueInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "NotFoundError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

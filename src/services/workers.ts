/**
 * Cloudflare Workers API service operations.
 * 
 * Provides Effect-based operations for:
 * - Listing Worker scripts
 * - Getting individual script details
 * - Creating/updating scripts
 * - Deleting scripts
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
 * Worker script metadata returned by the API.
 */
const WorkerScript = S.Struct({
  id: S.String,
  etag: S.String,
  created_on: S.String,
  modified_on: S.String,
  script: S.optional(S.String),
  compatibility_date: S.optional(S.String),
  compatibility_flags: S.optional(S.Array(S.String)),
  usage_model: S.optional(S.String),
  bindings: S.optional(S.Array(S.Unknown)),
});

/**
 * List scripts input (no parameters required).
 */
const ListScriptsInput = S.Struct({});

/**
 * List scripts output.
 */
const ListScriptsOutput = S.Array(WorkerScript);

/**
 * Get script input.
 */
const GetScriptInput = S.Struct({
  scriptName: S.String,
});

/**
 * Get script output.
 */
const GetScriptOutput = WorkerScript;

/**
 * Create/update script input.
 */
const CreateScriptInput = S.Struct({
  scriptName: S.String,
  script: S.String,
  metadata: S.optional(S.Struct({
    main_module: S.optional(S.String),
    compatibility_date: S.optional(S.String),
    compatibility_flags: S.optional(S.Array(S.String)),
    usage_model: S.optional(S.String),
    bindings: S.optional(S.Array(S.Unknown)),
  })),
});

/**
 * Create/update script output.
 */
const CreateScriptOutput = WorkerScript;

/**
 * Delete script input.
 */
const DeleteScriptInput = S.Struct({
  scriptName: S.String,
});

/**
 * Delete script output (null on success).
 */
const DeleteScriptOutput = S.Null;

// ============================================================================
// Operations
// ============================================================================

/**
 * List all Worker scripts in the account.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - RateLimitError: Too many requests
 */
export const listScripts: Operation<
  typeof ListScriptsInput.Type,
  typeof ListScriptsOutput.Type
> = Object.assign(
  (input: typeof ListScriptsInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* get<typeof ListScriptsOutput.Type>(
        `/accounts/${accountId}/workers/scripts`
      );
    }),
  {
    input: ListScriptsInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

/**
 * Get a specific Worker script by name.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - NotFoundError: Script does not exist
 * - RateLimitError: Too many requests
 */
export const getScript: Operation<
  typeof GetScriptInput.Type,
  typeof GetScriptOutput.Type
> = Object.assign(
  (input: typeof GetScriptInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* get<typeof GetScriptOutput.Type>(
        `/accounts/${accountId}/workers/scripts/${input.scriptName}`
      );
    }),
  {
    input: GetScriptInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "NotFoundError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

/**
 * Create or update a Worker script.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - ValidationError: Invalid script content or metadata
 * - QuotaExceededError: Account has reached script limit
 * - RateLimitError: Too many requests
 */
export const createScript: Operation<
  typeof CreateScriptInput.Type,
  typeof CreateScriptOutput.Type
> = Object.assign(
  (input: typeof CreateScriptInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      
      // Cloudflare Workers API expects multipart/form-data for script uploads
      // For now, we'll use a simplified JSON approach
      const body = {
        script: input.script,
        ...input.metadata,
      };
      
      return yield* put<typeof CreateScriptOutput.Type>(
        `/accounts/${accountId}/workers/scripts/${input.scriptName}`,
        body
      );
    }),
  {
    input: CreateScriptInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "ValidationError" as const },
      { _tag: "QuotaExceededError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

/**
 * Delete a Worker script.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - NotFoundError: Script does not exist
 * - RateLimitError: Too many requests
 */
export const deleteScript: Operation<
  typeof DeleteScriptInput.Type,
  typeof DeleteScriptOutput.Type
> = Object.assign(
  (input: typeof DeleteScriptInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* del<typeof DeleteScriptOutput.Type>(
        `/accounts/${accountId}/workers/scripts/${input.scriptName}`
      );
    }),
  {
    input: DeleteScriptInput,
    errors: [
      { _tag: "AuthenticationError" as const },
      { _tag: "NotFoundError" as const },
      { _tag: "RateLimitError" as const },
    ],
  }
);

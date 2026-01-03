/**
 * D1 (SQL Database) service operations.
 * 
 * Provides type-safe operations for:
 * - Listing databases
 * - Creating databases
 * - Deleting databases
 * - Executing queries
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
 * D1 Database schema
 */
const Database = S.Struct({
  uuid: S.String,
  name: S.String,
  version: S.String,
  created_at: S.String,
});

/**
 * List databases input (no parameters needed)
 */
const ListDatabasesInput = S.Struct({});

/**
 * List databases output
 */
const ListDatabasesOutput = S.Array(Database);

/**
 * Create database input
 */
const CreateDatabaseInput = S.Struct({
  name: S.String,
});

/**
 * Create database output
 */
const CreateDatabaseOutput = Database;

/**
 * Delete database input
 */
const DeleteDatabaseInput = S.Struct({
  databaseId: S.String,
});

/**
 * Delete database output (empty response on success)
 */
const DeleteDatabaseOutput = S.Struct({});

/**
 * Query result row (dynamic structure)
 */
const QueryResultRow = S.Record({ key: S.String, value: S.Unknown });

/**
 * Query result metadata
 */
const QueryResultMeta = S.Struct({
  changed_db: S.Boolean,
  changes: S.Number,
  duration: S.Number,
  last_row_id: S.Number,
  rows_read: S.Number,
  rows_written: S.Number,
  size_after: S.Number,
});

/**
 * Execute query input
 */
const ExecuteQueryInput = S.Struct({
  databaseId: S.String,
  sql: S.String,
  params: S.optional(S.Array(S.Unknown)),
});

/**
 * Execute query output
 */
const ExecuteQueryOutput = S.Struct({
  results: S.Array(QueryResultRow),
  success: S.Boolean,
  meta: QueryResultMeta,
});

// ============================================================================
// Known Errors
// ============================================================================

const listDatabasesErrors = [
  { _tag: "AuthenticationError" as const },
  { _tag: "RateLimitError" as const },
];

const createDatabaseErrors = [
  { _tag: "AuthenticationError" as const },
  { _tag: "ValidationError" as const },
  { _tag: "AlreadyExistsError" as const },
  { _tag: "QuotaExceededError" as const },
  { _tag: "RateLimitError" as const },
];

const deleteDatabaseErrors = [
  { _tag: "AuthenticationError" as const },
  { _tag: "NotFoundError" as const },
  { _tag: "RateLimitError" as const },
];

const executeQueryErrors = [
  { _tag: "AuthenticationError" as const },
  { _tag: "NotFoundError" as const },
  { _tag: "ValidationError" as const },
  { _tag: "RateLimitError" as const },
];

// ============================================================================
// Operations
// ============================================================================

/**
 * List all D1 databases in the account.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - RateLimitError: Too many requests
 */
export const listDatabases: Operation<
  typeof ListDatabasesInput.Type,
  typeof ListDatabasesOutput.Type
> = Object.assign(
  (input: typeof ListDatabasesInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* get<typeof ListDatabasesOutput.Type>(
        `/accounts/${accountId}/d1/database`
      );
    }),
  {
    input: ListDatabasesInput,
    errors: listDatabasesErrors,
  }
);

/**
 * Create a new D1 database.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - ValidationError: Invalid database name or parameters
 * - AlreadyExistsError: Database with this name already exists
 * - QuotaExceededError: Account has reached database limit
 * - RateLimitError: Too many requests
 */
export const createDatabase: Operation<
  typeof CreateDatabaseInput.Type,
  typeof CreateDatabaseOutput.Type
> = Object.assign(
  (input: typeof CreateDatabaseInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* post<typeof CreateDatabaseOutput.Type>(
        `/accounts/${accountId}/d1/database`,
        { name: input.name }
      );
    }),
  {
    input: CreateDatabaseInput,
    errors: createDatabaseErrors,
  }
);

/**
 * Delete a D1 database.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - NotFoundError: Database does not exist
 * - RateLimitError: Too many requests
 */
export const deleteDatabase: Operation<
  typeof DeleteDatabaseInput.Type,
  typeof DeleteDatabaseOutput.Type
> = Object.assign(
  (input: typeof DeleteDatabaseInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      return yield* del<typeof DeleteDatabaseOutput.Type>(
        `/accounts/${accountId}/d1/database/${input.databaseId}`
      );
    }),
  {
    input: DeleteDatabaseInput,
    errors: deleteDatabaseErrors,
  }
);

/**
 * Execute a SQL query against a D1 database.
 * 
 * Known errors:
 * - AuthenticationError: Invalid or missing API token
 * - NotFoundError: Database does not exist
 * - ValidationError: Invalid SQL syntax or parameters
 * - RateLimitError: Too many requests
 */
export const executeQuery: Operation<
  typeof ExecuteQueryInput.Type,
  typeof ExecuteQueryOutput.Type
> = Object.assign(
  (input: typeof ExecuteQueryInput.Type) =>
    Effect.gen(function* () {
      const { accountId } = yield* CloudflareAccountId;
      
      const body: Record<string, unknown> = {
        sql: input.sql,
      };
      
      if (input.params) {
        body.params = input.params;
      }
      
      return yield* post<typeof ExecuteQueryOutput.Type>(
        `/accounts/${accountId}/d1/database/${input.databaseId}/query`,
        body
      );
    }),
  {
    input: ExecuteQueryInput,
    errors: executeQueryErrors,
  }
);

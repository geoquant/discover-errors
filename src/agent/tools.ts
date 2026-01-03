/**
 * Agent Tools for Cloudflare API exploration.
 * 
 * Provides @effect/ai Tool definitions for:
 * - ListServices: List all available Cloudflare services
 * - ListOperations: List operations for a specific service
 * - DescribeOperation: Get schema and error info for an operation
 * - CallApi: Execute a Cloudflare API operation
 * - RenameError: Report incorrect error tags
 */

import { Tool, Toolkit } from "@effect/ai";
import * as S from "effect/Schema";
import * as JSONSchema from "effect/JSONSchema";
import { Effect, Console } from "effect";
import * as Services from "../services/index.ts";
import type { CloudflareErrorType } from "../cloudflare/errors.ts";
import type { DiscoveredError } from "../output/types-generator.ts";

// ============================================================================
// Discovery State - Track discovered errors
// ============================================================================

export const discoveredErrors: DiscoveredError[] = [];

/**
 * Record a discovered error.
 */
export const recordError = (
  service: string,
  operation: string,
  tag: string,
  code: number,
  message: string,
  isNew: boolean
): void => {
  discoveredErrors.push({
    service,
    operation,
    tag,
    code,
    message,
    discoveredAt: new Date().toISOString(),
  });
  
  // Log to stderr for debugging
  if (isNew) {
    console.error(`[DISCOVERED] ${service}.${operation}: ${tag} (${code}) - ${message}`);
  }
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get service module by name.
 */
const getService = (serviceName: string) => {
  const services: Record<string, any> = {
    Workers: Services.Workers,
    KV: Services.KV,
    R2: Services.R2,
    D1: Services.D1,
  };
  return services[serviceName];
};

/**
 * Get operation from a service by name.
 */
const getOperation = (serviceName: string, operationName: string) => {
  const service = getService(serviceName);
  if (!service) return undefined;
  return service[operationName];
};

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * List all available Cloudflare services.
 */
export const listServices = Tool.make("ListServices", {
  description: "List all available Cloudflare services",
  success: S.Array(S.String),
  parameters: {},
});

/**
 * List all operations for a given Cloudflare service.
 */
export const listOperations = Tool.make("ListOperations", {
  description: "List all operations for a given Cloudflare service",
  success: S.Array(S.String),
  failure: S.String,
  parameters: {
    service: S.String.annotations({
      description: "The Cloudflare service name (Workers, KV, R2, D1)",
    }),
  },
});

/**
 * Describe a Cloudflare operation's schema (input and known errors).
 */
export const describeOperation = Tool.make("DescribeOperation", {
  description: "Describe a Cloudflare operation's schema (input and known errors)",
  success: S.String,
  failure: S.String,
  parameters: {
    service: S.String.annotations({
      description: "The Cloudflare service name",
    }),
    operation: S.String.annotations({
      description: "The operation name to describe",
    }),
  },
});

/**
 * Call a Cloudflare API operation.
 * Returns success message or error details. NEW errors are flagged.
 */
export const callApi = Tool.make("CallApi", {
  description: "Call a Cloudflare API. Returns success message or error details. NEW errors are flagged.",
  success: S.String,
  failure: S.Any,
  parameters: {
    service: S.String.annotations({
      description: "The Cloudflare service (Workers, KV, R2, D1)",
    }),
    operation: S.String.annotations({
      description: "The operation to call",
    }),
    input: S.String.annotations({
      description: "JSON input matching the operation's input schema",
    }),
  },
});

/**
 * Report that an error has an incorrect name in the spec.
 */
export const renameError = Tool.make("RenameError", {
  description: "Report that an error has an incorrect name in the spec",
  failure: S.String,
  parameters: {
    service: S.String,
    operation: S.String,
    oldTag: S.String.annotations({ description: "Current incorrect tag" }),
    newTag: S.String.annotations({ description: "Correct tag from API" }),
  },
});

// ============================================================================
// Toolkit
// ============================================================================

/**
 * Toolkit combining all agent tools.
 */
export const toolkit = Toolkit.make(
  listServices,
  listOperations,
  describeOperation,
  callApi,
  renameError,
);

// ============================================================================
// Tool Implementations Layer
// ============================================================================

/**
 * Layer providing implementations for all tools.
 */
export const toolsLayer = toolkit.toLayer(
  Effect.gen(function* () {
    return {
      ListServices: Effect.fn(function* () {
        yield* Console.log("ListServices");
        return ["Workers", "KV", "R2", "D1"];
      }),

      ListOperations: Effect.fn(function* ({ service }) {
        yield* Console.log("ListOperations", service);
        const svc = getService(service);
        if (!svc) {
          return yield* Effect.fail(`Service "${service}" not found. Available: Workers, KV, R2, D1`);
        }
        return Object.keys(svc).filter(k => typeof svc[k] === "function");
      }),

      DescribeOperation: Effect.fn(function* ({ service, operation }) {
        yield* Console.log("DescribeOperation", service, operation);
        const op = getOperation(service, operation);
        if (!op) {
          return yield* Effect.fail(`Operation "${operation}" not found in service "${service}"`);
        }
        const spec = {
          inputSchema: op.input ? JSON.stringify(JSONSchema.make(op.input), null, 2) : "No schema",
          knownErrors: op.errors?.map((e: any) => e._tag) ?? [],
        };
        return JSON.stringify(spec, null, 2);
      }),

      CallApi: ({ service, operation, input }) =>
        Effect.gen(function* () {
          yield* Console.log(`\x1b[34mCallApi: ${service}.${operation}\x1b[0m`);
          
          const op = getOperation(service, operation);
          if (!op) {
            return yield* Effect.fail(`Operation "${operation}" not found in "${service}"`);
          }
          
          // Parse input JSON - handle various input formats
          let parsedInput: Record<string, unknown>;
          try {
            if (typeof input === "object" && input !== null) {
              parsedInput = input as Record<string, unknown>;
            } else if (typeof input === "string") {
              // Handle empty or whitespace strings
              const trimmed = input.trim();
              if (trimmed === "" || trimmed === "{}") {
                parsedInput = {};
              } else {
                parsedInput = JSON.parse(trimmed);
              }
            } else {
              parsedInput = {};
            }
          } catch (e) {
            // If JSON parsing fails, try to be helpful
            return `Error: Invalid JSON input. Expected valid JSON object, got: "${String(input).slice(0, 50)}"`;
          }
          
          // Get known error tags
          const knownErrors = new Set(op.errors?.map((e: any) => e._tag) ?? []);
          
          // Execute the operation
          const result: string = yield* op(parsedInput).pipe(
            Effect.map((response) => {
              const summary = JSON.stringify(response).slice(0, 200);
              return `Success: ${summary}...`;
            }),
            Effect.catchAll((err: CloudflareErrorType) => {
              const errorTag = err._tag;
              const message = "message" in err ? err.message : String(err);
              const code = "code" in err ? (err as any).code : 0;
              const isNew = !knownErrors.has(errorTag);
              
              // Record the error for later analysis
              recordError(service, operation, errorTag, code, message, isNew);
              
              if (isNew) {
                return Effect.succeed(`⚠️ NEW ERROR DISCOVERED: "${errorTag}" - ${message}`);
              } else {
                return Effect.succeed(`Error "${errorTag}" (known): ${message}`);
              }
            })
          );
          
          return result;
        }) as Effect.Effect<string, any, never>,

      RenameError: Effect.fn(function* ({ service, operation, oldTag, newTag }) {
        const op = getOperation(service, operation);
        if (!op) {
          return yield* Effect.fail(`Operation "${operation}" not found in "${service}"`);
        }
        yield* Console.log(`🔄 RENAME: ${service}.${operation} -> "${oldTag}" should be "${newTag}"`);
      }),
    };
  })
);

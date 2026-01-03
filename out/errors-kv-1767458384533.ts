/**
 * Auto-generated Cloudflare API error types.
 * Generated: 2026-01-03T16:39:44.533Z
 */

// KV Errors

export type KVGetValueError =
  | { _tag: "ValidationError"; code: 10011; message: string }
  | { _tag: "CloudflareError"; code: 0; message: string }
  | { _tag: "NotFoundError"; code: 10013; message: string }
;

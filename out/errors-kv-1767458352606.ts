/**
 * Auto-generated Cloudflare API error types.
 * Generated: 2026-01-03T16:39:12.606Z
 */

// KV Errors

export type KVListKeysError =
  | { _tag: "ValidationError"; code: 10011; message: string }
  | { _tag: "NotFoundError"; code: 10013; message: string }
  | { _tag: "ValidationError"; code: 10028; message: string }
;

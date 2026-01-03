/**
 * Auto-generated Cloudflare API error types.
 * Generated: 2026-01-03T16:41:50.357Z
 */

// R2 Errors

export type R2GetBucketError =
  | { _tag: "NotFoundError"; code: 10006; message: string }
  | { _tag: "ValidationError"; code: 10005; message: string }
;

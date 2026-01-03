/**
 * Auto-generated Cloudflare API error types.
 * Generated: 2026-01-03T16:45:14.773Z
 */

// D1 Errors

export type D1ExecuteQueryError =
  | { _tag: "ValidationError"; code: 7400; message: string }
  | { _tag: "UnknownCloudflareError"; code: 7001; message: string }
  | { _tag: "NotFoundError"; code: 7404; message: string }
;

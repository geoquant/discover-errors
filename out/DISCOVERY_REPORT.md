# Cloudflare API Error Discovery Report

Generated: 2026-01-03T16:46:18.346Z

## D1

### createDatabase

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 401 | **NO** | Authentication error |

### deleteDatabase

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 401 | Yes | Authentication error |

### executeQuery

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 7404 | 404 | Yes | The database 550e8400-e29b-41d4-a716-446655440000  |
| UnknownCloudflareError | 7001 | 405 | **NO** | POST not supported for requested URI. |
| ValidationError | 7400 | 400 | Yes | Invalid property: databaseId => Invalid uuid |

## Kv

### createNamespace

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 403 | **NO** | Authentication error |

### deleteNamespace

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 405 | Yes | DELETE method not allowed for the api_token authen |

### deleteValue

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 405 | Yes | DELETE method not allowed for the api_token authen |

### getValue

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| CloudflareError | 0 | 404 | **NO** | Unknown error: API returned success=false but no e |
| NotFoundError | 10013 | 404 | Yes | get: 'namespace not found' |
| ValidationError | 10011 | 400 | **NO** | could not parse UUID from request's namespace_id:  |

### listKeys

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10013 | 404 | Yes | list keys: 'namespace not found' |
| ValidationError | 10011 | 400 | **NO** | could not parse UUID from request's namespace_id:  |

### putValue

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 405 | Yes | PUT method not allowed for the api_token authentic |

## R2

### createBucket

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 403 | **NO** | Authentication error |

### deleteBucket

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 403 | Yes | Authentication error |

### getBucket

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10006 | 404 | Yes | The specified bucket does not exist. |
| ValidationError | 10005 | 400 | **NO** | The specified bucket name is not valid. |

## Workers

### createScript

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 403 | **NO** | Authentication error |

### deleteScript

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10000 | 403 | Yes | Authentication error |

### getScript

| Error | Code | HTTP | Documented | Message |
|-------|------|------|------------|---------|
| NotFoundError | 10007 | 404 | Yes | This Worker does not exist on your account. |
| ValidationError | 10016 | 400 | **NO** | Invalid Worker name. Ensure the name is lowercase, |

## Summary

| Metric | Value |
|--------|-------|
| Operations Analyzed | 15 |
| Total Unique Errors | 22 |
| Documented Errors | 12 |
| **Undocumented Errors** | **10** |

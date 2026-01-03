# Cloudflare API Error Discovery Tool - Architecture & Plan

## Overview

This tool uses an AI agent to **systematically discover undocumented or incorrectly named error codes** in Cloudflare API operations. Like the AWS reference implementation ([itty-aws/discover-errors.ts](https://github.com/alchemy-run/itty-aws/blob/main/src/patch/discover-errors.ts)), it probes APIs with various inputs and resource states to trigger errors, comparing discovered errors against documented specifications.

**Why this matters:**
- API specifications often have incomplete error definitions
- Some errors are missing entirely from documentation
- Error names in specs may not match actual API responses
- Comprehensive error handling requires knowing ALL possible error cases

**How it works:**
The agent autonomously explores Cloudflare APIs using a set of tools, testing different scenarios to discover errors. When a new error is found, it's automatically recorded for later inclusion in type-safe client libraries.

---

## Architecture

### Technology Stack

- **Runtime**: Bun (instead of Node.js)
- **Effect Framework**: 
  - `@effect/ai` - AI agent orchestration with tool-calling
  - `@effect/ai-anthropic` - Claude as the reasoning engine
  - `@effect/cli` - Command-line interface
  - `@effect/platform-node` - Platform abstractions
  - `@effect/experimental` - Persistence layer
  - `effect` - Core Effect library

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Agent (Claude)                       │
│                                                              │
│  - Receives task: "Discover errors for Workers.createScript"│
│  - Plans exploration strategy                               │
│  - Uses tools to probe API                                  │
│  - Learns from responses                                    │
│  - Continues until exhaustive                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Toolkit                             │
│                                                              │
│  1. ListServices      - Get available CF services           │
│  2. ListOperations    - Get operations for a service        │
│  3. DescribeOperation - Get input schema + known errors     │
│  4. CallApi           - Execute API call, detect errors     │
│  5. RenameError       - Flag incorrectly named errors       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare REST API                       │
│                                                              │
│  Base: https://api.cloudflare.com/client/v4/                │
│  Auth: Bearer {API_TOKEN}                                   │
│                                                              │
│  Returns: { success: bool, errors: [], messages: [] }       │
└─────────────────────────────────────────────────────────────┘
```

### Effect System Design

The tool follows Effect TS patterns:
- **Tools** are defined using `Tool.make()` with typed parameters and responses
- **Toolkit** combines tools using `Toolkit.make()`
- **Effect chain** handles async operations, errors, and dependencies
- **Layer system** provides services (Credentials, HTTP Client, Model)
- **Chat interface** manages conversational AI loop with tool-calling

---

## Cloudflare Services Coverage

### Target Services & Endpoints

#### 1. **Workers** (Scripts, Routes, Deployments)

**Base**: `/accounts/{account_id}/workers/`

Key operations:
- `createScript` - Upload Worker script
  - POST `/scripts/{script_name}`
  - Errors: ScriptAlreadyExists, InvalidScript, QuotaExceeded
- `getScript` - Retrieve script code/metadata
  - GET `/scripts/{script_name}`
  - Errors: ScriptNotFound, UnauthorizedAccess
- `updateScript` - Update existing script
  - PUT `/scripts/{script_name}`
  - Errors: ScriptNotFound, InvalidScript, DeploymentInProgress
- `deleteScript` - Delete script
  - DELETE `/scripts/{script_name}`
  - Errors: ScriptNotFound, ScriptHasActiveRoutes
- `listScripts` - List all scripts
  - GET `/scripts`
- `createRoute` - Add route to script
  - POST `/scripts/{script_name}/routes`
  - Errors: RouteAlreadyExists, InvalidPattern, ScriptNotFound
- `deleteRoute` - Remove route
  - DELETE `/scripts/{script_name}/routes/{route_id}`
  - Errors: RouteNotFound
- `createDeployment` - Deploy script version
  - POST `/scripts/{script_name}/deployments`
  - Errors: NoChangesToDeploy, DeploymentFailed

#### 2. **Workers KV** (Namespaces, Keys)

**Base**: `/accounts/{account_id}/storage/kv/namespaces/`

Key operations:
- `createNamespace` - Create KV namespace
  - POST `/namespaces`
  - Errors: NamespaceAlreadyExists, InvalidTitle, QuotaExceeded
- `listNamespaces` - List all namespaces
  - GET `/namespaces`
- `deleteNamespace` - Delete namespace
  - DELETE `/namespaces/{namespace_id}`
  - Errors: NamespaceNotFound, NamespaceNotEmpty
- `writeValue` - Write key-value pair
  - PUT `/namespaces/{namespace_id}/values/{key_name}`
  - Errors: NamespaceNotFound, InvalidKey, ValueTooLarge
- `readValue` - Read value by key
  - GET `/namespaces/{namespace_id}/values/{key_name}`
  - Errors: NamespaceNotFound, KeyNotFound
- `deleteValue` - Delete key
  - DELETE `/namespaces/{namespace_id}/values/{key_name}`
  - Errors: NamespaceNotFound, KeyNotFound
- `listKeys` - List all keys in namespace
  - GET `/namespaces/{namespace_id}/keys`
  - Errors: NamespaceNotFound

#### 3. **R2 Storage** (Buckets, Objects)

**Base**: `/accounts/{account_id}/r2/buckets/`

Key operations:
- `createBucket` - Create R2 bucket
  - POST `/buckets`
  - Errors: BucketAlreadyExists, InvalidBucketName, QuotaExceeded
- `listBuckets` - List all buckets
  - GET `/buckets`
- `deleteBucket` - Delete bucket
  - DELETE `/buckets/{bucket_name}`
  - Errors: BucketNotFound, BucketNotEmpty
- `getBucket` - Get bucket info
  - GET `/buckets/{bucket_name}`
  - Errors: BucketNotFound
- `putObject` - Upload object (uses S3-compatible API)
  - PUT `/{bucket_name}/{object_key}`
  - Errors: NoSuchBucket, InvalidKey, QuotaExceeded
- `getObject` - Download object
  - GET `/{bucket_name}/{object_key}`
  - Errors: NoSuchBucket, NoSuchKey
- `deleteObject` - Delete object
  - DELETE `/{bucket_name}/{object_key}`
  - Errors: NoSuchBucket, NoSuchKey
- `listObjects` - List bucket objects
  - GET `/{bucket_name}`
  - Errors: NoSuchBucket

#### 4. **D1 Databases** (Databases, Queries)

**Base**: `/accounts/{account_id}/d1/database/`

Key operations:
- `createDatabase` - Create D1 database
  - POST `/database`
  - Errors: DatabaseAlreadyExists, InvalidName, QuotaExceeded
- `listDatabases` - List all databases
  - GET `/database`
- `deleteDatabase` - Delete database
  - DELETE `/database/{database_id}`
  - Errors: DatabaseNotFound, DatabaseNotEmpty
- `query` - Execute SQL query
  - POST `/database/{database_id}/query`
  - Errors: DatabaseNotFound, InvalidSQL, QueryTimeout
- `raw` - Execute raw SQL
  - POST `/database/{database_id}/raw`
  - Errors: DatabaseNotFound, InvalidSQL

---

## Error Discovery Strategy

### Principles (Adapted from AWS Reference)

The agent follows a systematic approach to discover errors:

#### 1. **Setup-Based Error Discovery**
Create real resources to trigger state-based errors (not just test with non-existent resources).

**Create-then-Conflict Pattern:**
```typescript
// Example: Trigger "ScriptAlreadyExists"
1. CallApi(createScript, { name: "test-worker", ... })  // Success
2. CallApi(createScript, { name: "test-worker", ... })  // → ScriptAlreadyExists
```

**Resource-Exists-But-Wrong-State Pattern:**
```typescript
// Example: Trigger "ScriptHasActiveRoutes"
1. CallApi(createScript, { name: "test-worker", ... })
2. CallApi(createRoute, { script: "test-worker", pattern: "example.com/*" })
3. CallApi(deleteScript, { name: "test-worker" })  // → ScriptHasActiveRoutes
```

**Quota/Limit Pattern:**
```typescript
// Example: Trigger quota errors
1. Create 100+ namespaces rapidly → QuotaExceeded
2. Write 1GB+ value to KV → ValueTooLarge
```

#### 2. **Validation Error Discovery**
Probe with invalid inputs to trigger validation errors.

```typescript
// Invalid names/patterns
CallApi(createBucket, { name: "Invalid Bucket Name!" })  // → InvalidBucketName
CallApi(createScript, { name: "" })  // → InvalidName/MissingParameter

// Invalid formats
CallApi(query, { sql: "INVALID SQL SYNTAX" })  // → InvalidSQL
CallApi(createRoute, { pattern: "not-a-valid-pattern" })  // → InvalidPattern
```

#### 3. **Missing Resource Error Discovery**
Test with non-existent identifiers.

```typescript
CallApi(getScript, { name: "nonexistent-worker-abc123" })  // → ScriptNotFound
CallApi(readValue, { namespace: "fake-ns", key: "test" })  // → NamespaceNotFound
CallApi(getObject, { bucket: "fake-bucket", key: "test.txt" })  // → NoSuchBucket
```

#### 4. **Permission/Auth Error Discovery**
Test with invalid/missing credentials.

```typescript
// Invalid API token
CallApi(listScripts, {}, { auth: "invalid-token" })  // → InvalidToken/Unauthorized

// Wrong account scope
CallApi(getScript, { account_id: "wrong-account" })  // → AccountNotFound/Forbidden
```

#### 5. **Iterative Exploration**
- Use `ListOperations` to find helper operations (create, delete, list)
- Use `DescribeOperation` to see input schema and known errors
- Use `CallApi` to execute and discover actual errors
- Use `RenameError` when discovered error name doesn't match spec

---

## Tool Design

### 1. ListServices

**Purpose**: Get all available Cloudflare service modules.

**Schema**:
```typescript
Tool.make("ListServices", {
  description: "List all available Cloudflare services",
  success: S.Array(S.String),  // ["Workers", "KV", "R2", "D1"]
  parameters: {},
});
```

**Implementation**:
```typescript
ListServices: Effect.fn(function* () {
  // Return service modules from generated client
  return Object.keys(CloudflareServices);
});
```

### 2. ListOperations

**Purpose**: Get all operations for a given service.

**Schema**:
```typescript
Tool.make("ListOperations", {
  description: "List all operations for a given Cloudflare service",
  success: S.Array(S.String),
  failure: S.String,
  parameters: {
    service: S.String.annotations({
      description: "The Cloudflare service to list operations for (e.g., Workers, KV)",
    }),
  },
});
```

**Implementation**:
```typescript
ListOperations: Effect.fn(function* ({ service }) {
  const svc = yield* getService(service);
  return Object.keys(svc);  // ["createScript", "getScript", ...]
});
```

### 3. DescribeOperation

**Purpose**: Get JSON schema for operation's input and list of known errors.

**Schema**:
```typescript
Tool.make("DescribeOperation", {
  description: "Describe a Cloudflare operation's schema (input, output, known errors)",
  success: S.String,  // JSON-serialized schema
  failure: S.String,
  parameters: {
    service: S.String.annotations({
      description: "The Cloudflare service (e.g., Workers)",
    }),
    operation: S.String.annotations({
      description: "The operation to describe (e.g., createScript)",
    }),
  },
});
```

**Implementation**:
```typescript
DescribeOperation: Effect.fn(function* ({ service, operation }) {
  const op = yield* getOperation(service, operation);
  const spec = {
    inputSchema: JSONSchema.make(op.input),
    outputSchema: JSONSchema.make(op.output),
    knownErrors: op.errors.map((err) => err._tag),
  };
  return JSON.stringify(spec, null, 2);
});
```

### 4. CallApi

**Purpose**: Execute a Cloudflare API call and detect errors (known vs NEW).

**Schema**:
```typescript
Tool.make("CallApi", {
  description: "Call a Cloudflare API. Returns success or error details.",
  success: S.String,
  failure: S.Any,
  dependencies: [CloudflareCredentials, CloudflareAccountId],
  parameters: {
    service: S.String.annotations({
      description: "The Cloudflare service (e.g., Workers)",
    }),
    operation: S.String.annotations({
      description: "The operation to call (e.g., createScript)",
    }),
    input: S.String.annotations({
      description: "JSON input matching operation's input schema",
    }),
  },
});
```

**Implementation**:
```typescript
CallApi: Effect.fn(function* ({ service, operation, input }) {
  const op = yield* getOperation(service, operation);
  const json = JSON.parse(input);
  
  // Get known errors
  const knownErrors = new Set([
    ...op.errors.map(e => e._tag),
    ...COMMON_CF_ERRORS.map(e => e._tag),
  ]);
  
  // Validate input
  const decoded = yield* S.decodeUnknown(op.input)(json).pipe(
    Effect.catchAll(() => Effect.succeed(null))
  );
  
  if (!decoded) {
    return "Input does not match operation's schema";
  }
  
  // Execute API call
  return yield* op(decoded).pipe(
    Effect.map(() => "Success: Operation completed"),
    Effect.catchAll((err: CloudflareError) => {
      const errorCode = err.code || err._tag || "Unknown";
      const isKnown = knownErrors.has(errorCode);
      
      if (isKnown) {
        return Effect.succeed(
          `Error "${errorCode}" (already defined): ${err.message}`
        );
      } else {
        // NEW ERROR DISCOVERED!
        yield* Console.log(`🚨 NEW ERROR: ${errorCode}`);
        yield* recordError(service, operation, errorCode, err.message);
        return Effect.succeed(
          `⚠️ NEW ERROR DISCOVERED: "${errorCode}" - ${err.message}`
        );
      }
    })
  );
});
```

### 5. RenameError

**Purpose**: Flag when a defined error has the wrong name.

**Schema**:
```typescript
Tool.make("RenameError", {
  description: "Report that an error has an incorrect name in the spec",
  failure: S.String,
  parameters: {
    service: S.String,
    operation: S.String,
    oldTag: S.String.annotations({
      description: "The incorrect tag in the spec",
    }),
    newTag: S.String.annotations({
      description: "The correct tag from API response",
    }),
  },
});
```

**Implementation**:
```typescript
RenameError: Effect.fn(function* ({ service, operation, oldTag, newTag }) {
  yield* validateOperation(service, operation);
  yield* Console.log(
    `🔄 RENAME: ${service}.${operation} -> "${oldTag}" should be "${newTag}"`
  );
  yield* recordRename(service, operation, oldTag, newTag);
});
```

---

## Output Format

### 1. TypeScript Discriminated Union Types

Each service generates type-safe error definitions:

```typescript
// workers/errors.ts
export type WorkersCreateScriptError =
  | { _tag: "ScriptAlreadyExists"; message: string; code: 10021 }
  | { _tag: "InvalidScript"; message: string; code: 10022 }
  | { _tag: "QuotaExceeded"; message: string; code: 10023 }
  | { _tag: "UnauthorizedAccess"; message: string; code: 10024 }
  | { _tag: "InvalidName"; message: string; code: 10025 };

export type WorkersDeleteScriptError =
  | { _tag: "ScriptNotFound"; message: string; code: 10026 }
  | { _tag: "ScriptHasActiveRoutes"; message: string; code: 10027 };
```

### 2. JSON Error Catalog (Per Service)

```json
// workers-errors.json
{
  "service": "Workers",
  "operations": {
    "createScript": {
      "errors": [
        {
          "tag": "ScriptAlreadyExists",
          "code": 10021,
          "description": "A script with this name already exists",
          "httpStatus": 409,
          "discovered": "2026-01-03T12:34:56Z",
          "triggerMethod": "create-then-conflict"
        },
        {
          "tag": "InvalidScript",
          "code": 10022,
          "description": "Script syntax or structure is invalid",
          "httpStatus": 400,
          "discovered": "2026-01-03T12:35:12Z",
          "triggerMethod": "invalid-input"
        }
      ]
    }
  }
}
```

### 3. Markdown Report

```markdown
# Cloudflare Workers - Error Discovery Report

## createScript

**Discovered Errors**: 5 (3 new, 2 already documented)

### New Errors Discovered

- ✨ `ScriptAlreadyExists` (code: 10021) - Triggered by create-then-conflict pattern
- ✨ `QuotaExceeded` (code: 10023) - Triggered by creating 100+ scripts
- ✨ `InvalidName` (code: 10025) - Triggered by empty script name

### Already Documented

- ✓ `InvalidScript` (code: 10022) - Already in spec
- ✓ `UnauthorizedAccess` (code: 10024) - Already in spec

### Renamed Errors

- 🔄 `NotFound` → `ScriptNotFound` (spec had generic name)
```

---

## Comparison to AWS Implementation

### Similarities

| Aspect | AWS Version | Cloudflare Version |
|--------|-------------|-------------------|
| **Agent Framework** | Effect + @effect/ai | Same |
| **AI Model** | Claude (Anthropic) | Same |
| **Tool Pattern** | ListServices, ListOps, Describe, CallApi, Rename | Same |
| **Discovery Strategy** | Create-then-conflict, validation, state-based | Same |
| **Error Detection** | Known vs NEW, auto-record | Same |
| **Output** | TypeScript unions + JSON | Same |

### Key Differences

| Aspect | AWS Version | Cloudflare Version |
|--------|-------------|-------------------|
| **Testing Environment** | **LocalStack** (local AWS emulator) | **Real Cloudflare Account** (no emulator exists) |
| **Error Structure** | Custom error types per service | Cloudflare's `{ success, errors[], messages[] }` format |
| **Authentication** | IAM credentials (key + secret) | **API Token** (Bearer) or Email + Key |
| **Scope** | Region-based (us-east-1, etc.) | **Account-based** (account_id required) |
| **API Base** | http://localhost:4566 (LocalStack) | https://api.cloudflare.com/client/v4/ |
| **Error Codes** | String tags (e.g., "NoSuchBucket") | **Numeric codes** + tags (e.g., 10021 + "ScriptAlreadyExists") |
| **Resource Cleanup** | Cheap (local) | **Must cleanup** (real resources, potential costs) |

### Cloudflare-Specific Considerations

#### 1. No LocalStack Equivalent
- **Implication**: All API calls hit production Cloudflare
- **Safety measures**:
  - Use dedicated test account (`CLOUDFLARE_TEST_ACCOUNT_ID`)
  - Name all resources with `test-error-discovery-` prefix
  - Implement aggressive cleanup after discovery sessions
  - Set rate limiting to avoid quota issues

#### 2. Account-Scoped Resources
- **Implication**: All API paths include `/accounts/{account_id}/`
- **Implementation**:
  ```typescript
  // Provide account ID as Effect service
  Effect.provideService(CloudflareAccountId, process.env.CLOUDFLARE_ACCOUNT_ID)
  ```

#### 3. Cloudflare Error Response Format
```json
{
  "success": false,
  "errors": [
    {
      "code": 10021,
      "message": "workers.api.error.script_already_exists"
    }
  ],
  "messages": [],
  "result": null
}
```

**Parsing**:
```typescript
if (!response.success) {
  const primaryError = response.errors[0];
  const errorTag = inferTagFromCode(primaryError.code, primaryError.message);
  // Compare against known errors
}
```

#### 4. Multiple Service Styles
- **REST API**: Workers, KV, D1 (JSON)
- **S3-Compatible**: R2 (XML responses for some operations)
- **Implementation**: Need separate parsers for each style

#### 5. Rate Limits
Cloudflare enforces strict rate limits:
- **Solution**: Add exponential backoff in `CallApi`
- **Tool**: Use Effect's `Effect.retry()` with `Schedule.exponential`

---

## Configuration

### Environment Variables

Create `.env` file:

```bash
# Required: Cloudflare API authentication
CLOUDFLARE_API_TOKEN=your_api_token_here
# OR (legacy auth)
CLOUDFLARE_EMAIL=your@email.com
CLOUDFLARE_API_KEY=your_api_key_here

# Required: Account ID for all operations
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# Required: Anthropic API key for Claude
ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional: Debug logging
DEBUG=true
```

### Getting Credentials

1. **API Token** (Recommended):
   - Go to Cloudflare Dashboard → My Profile → API Tokens
   - Create token with permissions:
     - Workers Scripts: Edit
     - Workers KV Storage: Edit
     - R2: Edit
     - D1: Edit

2. **Account ID**:
   - Go to any Cloudflare zone
   - Check URL: `dash.cloudflare.com/{account_id}/...`
   - Or use API: `GET /accounts` → find `id`

3. **Anthropic Key**:
   - https://console.anthropic.com/
   - Create API key

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE
- [x] Set up project structure
- [x] Implement Cloudflare HTTP client with auth
- [x] Create base Error types
- [x] Implement credential validation

### Phase 2: Service Definitions ✅ COMPLETE
- [x] Define Workers operations & schemas
- [x] Define KV operations & schemas
- [x] Define R2 operations & schemas
- [x] Define D1 operations & schemas
- [x] Map all known errors from docs

### Phase 3: Tool Implementation ✅ COMPLETE
- [x] Implement ListServices
- [x] Implement ListOperations
- [x] Implement DescribeOperation
- [x] Implement CallApi with error detection
- [x] Implement RenameError
- [x] Add error recording/persistence

### Phase 4: Agent Loop ✅ COMPLETE
- [x] Set up Effect AI chat interface
- [x] Create system prompt (adapted from AWS version)
- [x] Implement toolkit integration
- [x] Add streaming output
- [ ] Implement cleanup on exit (future enhancement)

### Phase 5: Testing & Discovery 🔄 READY TO TEST
- [ ] Test discovery on Workers service
- [ ] Test discovery on KV service
- [ ] Test discovery on R2 service
- [ ] Test discovery on D1 service
- [ ] Generate error catalogs
- [ ] Create TypeScript type exports

### Phase 6: Output Generation ✅ COMPLETE
- [x] Generate TypeScript discriminated unions
- [x] Generate JSON error catalogs
- [ ] Generate Markdown reports (future enhancement)
- [x] Create consolidated exports

---

## Usage Example

```bash
# Discover errors for Workers.createScript
bun run discover Workers createScript

# Discover errors for KV.writeValue
bun run discover KV writeValue

# Discover errors for R2.createBucket
bun run discover R2 createBucket

# Discover errors for D1.query
bun run discover D1 query
```

**Agent output**:
```
🤖 Discovering errors for Workers.createScript...

📋 Operation Schema:
   - Required: name, script
   - Optional: bindings, compatibility_date
   - Known errors: InvalidScript, UnauthorizedAccess

🔍 Testing create-then-conflict pattern...
   ✅ Creating test-worker-abc123... Success
   ❌ Creating test-worker-abc123 again...
   ⚠️ NEW ERROR DISCOVERED: "ScriptAlreadyExists" (code: 10021)

🔍 Testing invalid input pattern...
   ❌ Creating with empty name...
   ⚠️ NEW ERROR DISCOVERED: "InvalidName" (code: 10025)

🔍 Testing quota limits...
   ❌ Creating 101 scripts rapidly...
   ⚠️ NEW ERROR DISCOVERED: "QuotaExceeded" (code: 10023)

✅ Discovery complete!
   - 3 new errors discovered
   - 2 already documented
   - 0 renames suggested
```

---

## Next Steps

1. ~~**Review this plan** with the team~~ ✅
2. **Set up credentials** - Copy `.env.example` to `.env` and fill in:
   - `ANTHROPIC_API_KEY` - Claude API key
   - `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers/KV/R2/D1 permissions
   - `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
3. **Run discovery** - Test the tool with real Cloudflare APIs
4. **Iterate on agent prompts** based on discovery quality
5. **Expand to more services** after validating on Workers

## Quick Start

```bash
# Install dependencies
bun install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Run error discovery
bun src/main.ts discover Workers listScripts
bun src/main.ts discover KV listNamespaces
bun src/main.ts discover R2 listBuckets
bun src/main.ts discover D1 listDatabases
```

---

## References

- [AWS Reference Implementation](https://github.com/alchemy-run/itty-aws/blob/main/src/patch/discover-errors.ts)
- [Cloudflare API Docs](https://developers.cloudflare.com/api/)
- [Effect Documentation](https://effect.website/)
- [@effect/ai Documentation](https://effect.website/docs/ai/introduction)

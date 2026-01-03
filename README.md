# Cloudflare API Error Discovery

AI-powered tool to discover undocumented error codes in Cloudflare APIs by systematically probing endpoints with various inputs.

## Features

- **Effect TS-native** - Uses Effect patterns throughout (Context.Tag, Data.TaggedError, Effect.gen)
- **AI Agent** - Claude-powered agent with 5 tools for autonomous API exploration
- **Error Discovery** - Distinguishes known vs NEW errors, flagged with `NEW ERROR DISCOVERED`
- **Multi-Service** - Supports Workers, KV, R2, and D1 APIs (extensible to 100+ Cloudflare APIs)
- **Output Generators** - TypeScript discriminated unions + JSON catalogs
- **Rate Limiting** - Built-in protection against API rate limits with exponential backoff

## Setup

```bash
# Install dependencies
bun install

# Set up credentials
cp .env.example .env
# Edit .env with your API keys
```

### Required Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

### Cloudflare API Token Permissions

Create a token at https://dash.cloudflare.com/profile/api-tokens with:

- Account > Workers Scripts > Read
- Account > Workers KV Storage > Read  
- Account > Workers R2 Storage > Read
- Account > D1 > Read

See [API_PERMISSIONS.md](./API_PERMISSIONS.md) for the full list of 106 available Cloudflare API permissions.

## Usage

```bash
# Discover errors for a specific operation
bun src/main.ts <Service> <operation>

# Examples
bun src/main.ts Workers listScripts
bun src/main.ts Workers getScript
bun src/main.ts KV listNamespaces
bun src/main.ts R2 listBuckets
bun src/main.ts D1 listDatabases
```

## Output

Results are saved to the `out/` directory:

- `out/errors-<service>-<timestamp>.json` - JSON error catalog
- `out/errors-<service>-<timestamp>.ts` - TypeScript discriminated union types

### Example TypeScript Output

```typescript
export type WorkersGetScriptError =
  | { _tag: "NotFoundError"; code: 10007; message: string }
  | { _tag: "ValidationError"; code: 10016; message: string }
  | { _tag: "ParseError"; code: 0; message: string };
```

## Available Services & Operations

### Workers
- `listScripts` - List all Worker scripts
- `getScript` - Get a specific script
- `createScript` - Create/update a script
- `deleteScript` - Delete a script

### KV
- `listNamespaces` - List KV namespaces
- `createNamespace` - Create a namespace
- `deleteNamespace` - Delete a namespace
- `listKeys` - List keys in a namespace
- `getValue` - Get a value
- `putValue` - Put a value
- `deleteValue` - Delete a value

### R2
- `listBuckets` - List R2 buckets
- `getBucket` - Get bucket details
- `createBucket` - Create a bucket
- `deleteBucket` - Delete a bucket

### D1
- `listDatabases` - List D1 databases
- `createDatabase` - Create a database
- `deleteDatabase` - Delete a database
- `executeQuery` - Execute SQL query

## Architecture

```
src/
├── main.ts              # Entry point, Effect layers setup
├── cli.ts               # CLI commands with rate limiting
├── agent/
│   ├── index.ts         # Agent exports
│   └── tools.ts         # AI tools (ListServices, CallApi, etc.)
├── cloudflare/
│   ├── client.ts        # HTTP client with retry logic
│   ├── errors.ts        # Error type definitions
│   └── types.ts         # Cloudflare API types
├── services/
│   ├── workers.ts       # Workers API operations
│   ├── kv.ts            # KV API operations
│   ├── r2.ts            # R2 API operations
│   └── d1.ts            # D1 API operations
└── output/
    ├── json-generator.ts    # JSON catalog generator
    └── types-generator.ts   # TypeScript types generator
```

## License

MIT

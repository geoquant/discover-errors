/**
 * Main entry point for the discover-errors CLI.
 * 
 * Sets up Effect layers for:
 * - Anthropic Claude model
 * - Cloudflare credentials
 * - Agent toolkit
 * - Persistence (chat history)
 */

import { Effect, Layer, LogLevel, Logger } from "effect";
import { NodeContext, NodeHttpClient, NodeRuntime } from "@effect/platform-node";
import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic";
import * as Config from "effect/Config";
import * as Persistence from "@effect/experimental/Persistence";
import { cli } from "./cli.ts";
import { toolsLayer } from "./agent/index.ts";
import { CloudflareCredentials, CloudflareAccountId, CloudflareConfig, defaultCloudflareConfig } from "./cloudflare/types.ts";

// ============================================================================
// Anthropic Model Setup
// ============================================================================

const Anthropic = AnthropicClient.layerConfig({
  apiKey: Config.redacted("ANTHROPIC_API_KEY"),
});

const claudeModel = AnthropicLanguageModel.model("claude-haiku-4-5");

const model = Layer.provideMerge(claudeModel, Anthropic);

// ============================================================================
// Cloudflare Credentials
// ============================================================================

const cloudflareCredentials = Layer.succeed(
  CloudflareCredentials,
  { apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "" }
);

const cloudflareAccountId = Layer.succeed(
  CloudflareAccountId,
  { accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "" }
);

const cloudflareConfig = Layer.succeed(
  CloudflareConfig,
  defaultCloudflareConfig
);

// ============================================================================
// Run the CLI
// ============================================================================

Effect.gen(function* () {
  yield* cli(process.argv);
}).pipe(
  Logger.withMinimumLogLevel(
    process.env.DEBUG ? LogLevel.Debug : LogLevel.Info
  ),
  Effect.scoped,
  Effect.provide(toolsLayer),
  Effect.provide(model),
  Effect.provide(cloudflareCredentials),
  Effect.provide(cloudflareAccountId),
  Effect.provide(cloudflareConfig),
  Effect.provide(NodeContext.layer),
  Effect.provide(NodeHttpClient.layer),
  Effect.provide(Persistence.layerMemory),
  NodeRuntime.runMain,
);

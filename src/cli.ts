/**
 * CLI implementation using @effect/cli.
 * 
 * Provides the 'discover' command for exploring Cloudflare API errors.
 */

import { Command, Args } from "@effect/cli";
import * as Chat from "@effect/ai/Chat";
import { Effect, Stream, Schedule } from "effect";
import { toolkit, discoveredErrors } from "./agent/index.ts";
import { generateAllJson } from "./output/json-generator.ts";
import { generateTypes } from "./output/types-generator.ts";

// Configuration
const MAX_ITERATIONS = 10; // Maximum chat loop iterations
const ITERATION_DELAY_MS = 2000; // Delay between iterations to avoid rate limits

const SYSTEM_PROMPT = `You are a Cloudflare API error discovery agent. Your mission is to discover undocumented error codes by systematically probing APIs with various inputs.

## Your Tools
- **ListServices**: Get available services (Workers, KV, R2, D1)
- **ListOperations**: List operations for a service
- **DescribeOperation**: Get input schema and known errors
- **CallApi**: Execute API calls - watch for "NEW ERROR DISCOVERED" in responses!
- **RenameError**: Report incorrectly named errors

## Strategy
1. Use DescribeOperation to understand inputs and known errors
2. Call the API with valid/empty input first to verify it works
3. Test with a FEW targeted invalid inputs (max 5-6 calls per category)
4. Focus on inputs likely to trigger DIFFERENT error types, not variations of the same
5. When you see the same error repeatedly, move on to a different approach
6. After ~15-20 total API calls, summarize your findings and stop

## Important
- Be EFFICIENT - don't make redundant calls that return the same error
- All resources are prefixed with "test-discover-" for cleanup
- After discovery, provide a COMPLETE summary of all errors found (both new and known)
- You have a LIMITED number of iterations, so prioritize quality over quantity
`;

/**
 * The 'discover' command.
 * Initiates AI-driven error discovery for a Cloudflare service operation.
 */
export const discover = Command.make(
  "discover",
  {
    service: Args.text({ name: "service" }).pipe(
      Args.withDescription("Cloudflare service (Workers, KV, R2, D1)"),
    ),
    operation: Args.text({ name: "operation" }).pipe(
      Args.withDescription("Operation to discover errors for"),
    ),
  },
  ({ service, operation }) =>
    Effect.gen(function* () {
      const chat = yield* Chat.fromPrompt([
        { role: "system", content: SYSTEM_PROMPT },
      ]);

      const prompt = `Discover errors for ${service}.${operation}.

1. First use DescribeOperation to see the input schema and known errors
2. Then systematically probe the API using CallApi with:
   - Valid inputs (to verify success path)
   - Invalid/missing required fields
   - Non-existent resource IDs
   - Duplicate creation (create-then-conflict)
3. Watch for "NEW ERROR DISCOVERED" in responses
4. When done, summarize your findings`;

      yield* Effect.sync(() => {
        console.log(`\n🔍 Discovering errors for ${service}.${operation}...`);
        console.log(`   (max ${MAX_ITERATIONS} iterations, ${ITERATION_DELAY_MS}ms delay between)\n`);
      });

      // Run the chat loop with iteration limit
      let iteration = 0;
      let isFirstMessage = true;
      
      while (iteration < MAX_ITERATIONS) {
        iteration++;
        
        // Only send the prompt on first iteration; after that, just continue
        const currentPrompt = isFirstMessage 
          ? prompt 
          : `Continue. You have ${MAX_ITERATIONS - iteration} iterations remaining. If you've gathered enough data, summarize your findings now.`;
        isFirstMessage = false;
        
        yield* Effect.sync(() => {
          console.log(`\n--- Iteration ${iteration}/${MAX_ITERATIONS} ---`);
        });
        
        let finishReason: string | undefined;
        
        // Wrap stream processing with retry logic for rate limits
        const processStream = Effect.gen(function* () {
          const stream = chat.streamText({ toolkit, prompt: currentPrompt });
          
          yield* Stream.runForEach(stream, (part) =>
            Effect.sync(() => {
              const p = part as { type: string; delta?: string; name?: string; output?: unknown; reason?: string };
              switch (p.type) {
                case "text-delta":
                  process.stdout.write(p.delta ?? "");
                  break;
                case "text-end":
                  process.stdout.write("\n");
                  break;
                case "tool-result": {
                  // Tool result received - the model will continue
                  const result = part as any;
                  const output = result.output ?? result.value ?? result.result ?? "";
                  const displayOutput = typeof output === "string" 
                    ? output.slice(0, 200) 
                    : JSON.stringify(output).slice(0, 200);
                  console.log(`  → ${result.name ?? "tool"}: ${displayOutput}`);
                  break;
                }
                case "finish":
                  finishReason = p.reason;
                  break;
              }
            })
          );
        });
        
        // Retry with exponential backoff on rate limit errors
        yield* processStream.pipe(
          Effect.retry(
            Schedule.exponential(30000).pipe( // Start with 30s delay
              Schedule.compose(Schedule.recurs(3)), // Max 3 retries
              Schedule.tapInput((error: any) => 
                Effect.sync(() => {
                  if (error?.message?.includes("rate_limit") || error?.message?.includes("429")) {
                    console.log("\n⚠️ Rate limited. Waiting before retry...");
                  }
                })
              )
            )
          ),
          Effect.catchAll((error: any) => 
            Effect.sync(() => {
              if (error?.message?.includes("rate_limit") || error?.message?.includes("429")) {
                console.log("\n❌ Rate limit exceeded after retries. Please wait a minute and try again.");
              } else {
                console.log(`\n❌ Error: ${error?.message ?? error}`);
              }
              finishReason = "error";
            })
          )
        );

        // If the model finished with text (not tool-calls) or errored, we're done
        if (finishReason !== "tool-calls") {
          break;
        }
        
        // Add delay between iterations to avoid rate limiting
        if (iteration < MAX_ITERATIONS) {
          yield* Effect.sync(() => {
            console.log(`\n⏳ Waiting ${ITERATION_DELAY_MS}ms before next iteration...`);
          });
          yield* Effect.sleep(ITERATION_DELAY_MS);
        }
      }
      
      if (iteration >= MAX_ITERATIONS) {
        yield* Effect.sync(() => {
          console.log("\n⚠️ Reached maximum iterations. Forcing completion.");
        });
      }

      // Save results
      yield* Effect.sync(() => {
        console.log("\n✅ Discovery complete!\n");
        
        if (discoveredErrors.length > 0) {
          // Create output directory
          const outputDir = "out";
          const fs = require("fs");
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Save JSON catalog
          const catalogs = generateAllJson(discoveredErrors);
          const jsonPath = `${outputDir}/errors-${service.toLowerCase()}-${Date.now()}.json`;
          fs.writeFileSync(jsonPath, JSON.stringify(catalogs, null, 2));
          console.log(`📁 Saved error catalog: ${jsonPath}`);
          
          // Save TypeScript types
          const types = generateTypes(discoveredErrors);
          const typesPath = `${outputDir}/errors-${service.toLowerCase()}-${Date.now()}.ts`;
          fs.writeFileSync(typesPath, types);
          console.log(`📁 Saved TypeScript types: ${typesPath}`);
          
          // Summary
          console.log(`\n📊 Discovered ${discoveredErrors.length} error(s) total`);
        } else {
          console.log("No errors discovered in this run.");
        }
      });
    }).pipe(
      Effect.provide(Chat.layerPersisted({ storeId: "discover-chat" })),
    ),
);

/**
 * CLI runner for the discover command.
 */
export const cli = Command.run(discover, {
  name: "discover-errors",
  version: "1.0.0",
});

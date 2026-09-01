import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { SEED_PROMPTS } from "../engine/seeds";
import { FAKE_CUSTOMER_DATABASE } from "../clientAgent/database";
import { getAgentToolManifest } from "../clientAgent/agent";
import { runAdaptiveRedTeamingLoop } from "../engine/runner";
import { config, hasValidApiKey } from "../config";
import type { SSEEvent } from "../types";

export const testRunnerRouter = new Hono();

/**
 * GET /api/agent-tools
 * Returns the target agent's registered tools and automatically detected capability categories (Feature C).
 */
testRunnerRouter.get("/agent-tools", (c) => {
  return c.json(getAgentToolManifest());
});

/**
 * GET /api/seeds
 * Returns the full library of seed attack prompts with their required tool categories.
 */
testRunnerRouter.get("/seeds", (c) => {
  return c.json({
    total: SEED_PROMPTS.length,
    seeds: SEED_PROMPTS,
  });
});

/**
 * GET /api/database
 * Returns the toy client agent's customer database records for demo inspection.
 */
testRunnerRouter.get("/database", (c) => {
  return c.json({
    total: FAKE_CUSTOMER_DATABASE.length,
    records: FAKE_CUSTOMER_DATABASE,
  });
});

/**
 * GET /api/status
 * Returns API key status and configured models.
 */
testRunnerRouter.get("/status", (c) => {
  return c.json({
    hasApiKey: hasValidApiKey(),
    defaultModel: config.DEFAULT_MODEL_ID,
    clientAgentModel: config.CLIENT_AGENT_MODEL_ID,
    classifierModel: config.CLASSIFIER_MODEL_ID,
    mutatorModel: config.MUTATOR_MODEL_ID,
  });
});

/**
 * GET /api/run-test
 * Server-Sent Events (SSE) stream endpoint running the capability-aware red-teaming loop.
 */
testRunnerRouter.get("/run-test", async (c) => {
  if (!hasValidApiKey()) {
    console.warn("⚠️  [/api/run-test] Attempted test run without OPENROUTER_API_KEY.");
    return c.json(
      {
        error: "Missing OPENROUTER_API_KEY",
        message: "Please set OPENROUTER_API_KEY in your .env file to run the red-teaming engine.",
      },
      400
    );
  }

  console.log("🔌 [/api/run-test] Client connected to SSE stream.");

  return streamSSE(c, async (stream) => {
    try {
      await runAdaptiveRedTeamingLoop({
        abortSignal: c.req.raw.signal,
        onEvent: async (event: SSEEvent) => {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          });
        },
      });
      console.log("✅ [/api/run-test] Red-teaming loop completed successfully.");
    } catch (err) {
      console.error("❌ [/api/run-test] Error during red-teaming run SSE:", err);
      try {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          }),
        });
      } catch (streamErr) {
        console.error("❌ [/api/run-test] Failed to write SSE error event to stream:", streamErr);
      }
    }
  });
});

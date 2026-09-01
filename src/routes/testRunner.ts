import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { SEED_PROMPTS } from "../engine/seeds";
import { FAKE_CUSTOMER_DATABASE } from "../clientAgent/database";
import { runAdaptiveRedTeamingLoop } from "../engine/runner";
import { config, hasValidApiKey } from "../config";
import type { SSEEvent } from "../types";

export const testRunnerRouter = new Hono();

/**
 * GET /api/seeds
 * Returns the full library of 20 seed attack prompts.
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
 * Server-Sent Events (SSE) stream endpoint to run the red-teaming test suite.
 */
testRunnerRouter.get("/run-test", async (c) => {
  if (!hasValidApiKey()) {
    return c.json(
      {
        error: "Missing OPENROUTER_API_KEY",
        message: "Please set OPENROUTER_API_KEY in your .env file to run the red-teaming engine.",
      },
      400
    );
  }

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
    } catch (err) {
      console.error("Error during red-teaming run SSE:", err);
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        }),
      });
    }
  });
});

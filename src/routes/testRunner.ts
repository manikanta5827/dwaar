import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { runAdaptiveRedTeamingLoop } from "../engine/runner";
import { hasValidApiKey } from "../config";
import type { SSEEvent } from "../types";

export const testRunnerRouter = new Hono();

/**
 * GET /api/run-test
 * Server-Sent Events (SSE) stream endpoint to run the live test suite.
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

  const query = c.req.query();
  const seedIds = query.seeds ? query.seeds.split(",").map((s) => s.trim()) : undefined;

  return streamSSE(c, async (stream) => {
    try {
      await runAdaptiveRedTeamingLoop({
        selectedSeedIds: seedIds,
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

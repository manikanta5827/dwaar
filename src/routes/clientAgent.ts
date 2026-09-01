import { Hono } from "hono";
import { ClientAgentChatRequestSchema } from "../types";
import { callClientAgent } from "../clientAgent/agent";

export const clientAgentRouter = new Hono();

/**
 * POST /client-agent/chat
 * Public endpoint for the toy client agent.
 */
clientAgentRouter.post("/chat", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ClientAgentChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid request payload",
          details: parsed.error.format(),
        },
        400
      );
    }

    const response = await callClientAgent(parsed.data.message);
    return c.json({ response });
  } catch (error) {
    console.error("Error handling /client-agent/chat:", error);
    return c.json(
      {
        error: "Failed to generate client agent response",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

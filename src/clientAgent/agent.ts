import { generateText, tool, isStepCount } from "ai";
import { z } from "zod";
import { getModel, config, hasValidApiKey } from "../config";
import { CLIENT_AGENT_SYSTEM_PROMPT } from "./systemPrompt";
import { queryCustomerDatabase } from "./database";

export const searchCustomerDatabaseTool = tool({
  description: "Search customer database for records matching a name, email, company, or plan",
  inputSchema: z.object({
    query: z.string().describe("Search query keyword (name, company, email, plan, or * for all)"),
  }),
  execute: async ({ query }: { query: string }) => {
    const results = queryCustomerDatabase(query);
    return JSON.stringify(results, null, 2);
  },
});

/**
 * Executes a single turn against the toy client agent.
 * Handles live LLM inference with tool calling up to 3 steps.
 */
export async function callClientAgent(message: string, modelId?: string): Promise<string> {
  if (!hasValidApiKey()) {
    throw new Error("Missing OPENROUTER_API_KEY. Please set OPENROUTER_API_KEY in .env to run live LLM calls.");
  }

  const model = getModel(modelId || config.CLIENT_AGENT_MODEL_ID);
  const { text } = await generateText({
    model,
    system: CLIENT_AGENT_SYSTEM_PROMPT,
    prompt: message,
    tools: {
      search_customer_database: searchCustomerDatabaseTool,
    },
    stopWhen: isStepCount(3),
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(30_000),
  });

  return text || "I apologize, but I could not process that request.";
}

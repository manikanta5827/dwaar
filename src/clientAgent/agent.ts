import { generateText, tool, isStepCount } from "ai";
import { z } from "zod";
import { config, getModel, hasValidApiKey } from "../config";
import { CLIENT_AGENT_SYSTEM_PROMPT } from "./systemPrompt";
import { queryCustomerDatabase } from "./database";
import type { ToolCategory } from "../types";

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
 * Declared tools available to the toy client agent.
 */
export const CLIENT_AGENT_TOOLS = {
  search_customer_database: searchCustomerDatabaseTool,
};

/**
 * Automatically inspects the agent's registered tools and identifies their functional categories (Feature C).
 */
export function getAgentToolCategories(): ToolCategory[] {
  const categories = new Set<ToolCategory>(["system_prompt"]); // Base LLM always has system prompt / persona

  for (const [name, toolDef] of Object.entries(CLIENT_AGENT_TOOLS)) {
    const rawDesc = typeof toolDef.description === "string" ? toolDef.description : "";
    const desc = rawDesc.toLowerCase();
    const toolName = name.toLowerCase();

    // Database / Customer Data Category
    if (
      toolName.includes("database") ||
      toolName.includes("db") ||
      desc.includes("customer database") ||
      desc.includes("query database") ||
      desc.includes("sql")
    ) {
      categories.add("database");
    }

    // Email Outbound / Dispatcher Category
    if (
      toolName.includes("send_email") ||
      toolName.includes("mail_dispatch") ||
      desc.includes("send email") ||
      desc.includes("dispatch email") ||
      desc.includes("send mail")
    ) {
      categories.add("email");
    }

    // Payment / Stripe / Billing Category
    if (
      toolName.includes("payment") ||
      toolName.includes("stripe") ||
      toolName.includes("refund") ||
      desc.includes("process refund") ||
      desc.includes("charge credit") ||
      desc.includes("billing api")
    ) {
      categories.add("payment");
    }

    // Shell / Terminal / Code Execution Category
    if (
      toolName.includes("bash") ||
      toolName.includes("exec") ||
      toolName.includes("shell") ||
      toolName.includes("terminal") ||
      desc.includes("execute command") ||
      desc.includes("run terminal") ||
      desc.includes("run bash")
    ) {
      categories.add("terminal");
    }
  }

  return Array.from(categories);
}

/**
 * Returns metadata about the target agent's tools for demo inspection.
 */
export function getAgentToolManifest() {
  const detectedCategories = getAgentToolCategories();
  const tools = Object.entries(CLIENT_AGENT_TOOLS).map(([name, toolDef]) => ({
    name,
    description: typeof toolDef.description === "string" ? toolDef.description : "",
  }));

  return {
    toolCount: tools.length,
    tools,
    detectedCategories,
  };
}

/**
 * Executes a single turn against the toy client agent with retry on transient upstream provider errors.
 * Handles live LLM inference with tool calling up to 3 steps.
 */
export async function callClientAgent(message: string): Promise<string> {
  if (!hasValidApiKey()) {
    throw new Error("Missing OPENROUTER_API_KEY. Please set OPENROUTER_API_KEY in .env to run live LLM calls.");
  }

  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const { text } = await generateText({
        model: getModel(config.CLIENT_AGENT_MODEL_ID),
        system: CLIENT_AGENT_SYSTEM_PROMPT,
        prompt: message,
        tools: CLIENT_AGENT_TOOLS,
        stopWhen: isStepCount(3),
        temperature: 0.2,
        abortSignal: AbortSignal.timeout(30_000),
      });

      return text || "I apologize, but I could not process that request.";
    } catch (err: any) {
      if (attempt > maxRetries) {
        throw err;
      }
      console.warn(
        `⚠️  [Client Agent Transient Error] Retrying turn (${attempt}/${maxRetries}) after error:`,
        err?.message || err
      );
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }

  return "I apologize, but I could not process that request.";
}

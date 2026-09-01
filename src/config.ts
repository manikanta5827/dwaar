import { createOpenRouter, type OpenRouterSharedSettings } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

const ConfigSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional().default(""),
  PORT: z.coerce.number().default(3000),
  DEFAULT_MODEL_ID: z.string().default("openai/gpt-4o-mini"),
  CLIENT_AGENT_MODEL_ID: z.string().default("openai/gpt-4o-mini"),
  CLASSIFIER_MODEL_ID: z.string().default("openai/gpt-4o-mini"),
  MUTATOR_MODEL_ID: z.string().default("openai/gpt-4o-mini"),
});

const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

export const hasValidApiKey = (): boolean => {
  return typeof config.OPENROUTER_API_KEY === "string" && config.OPENROUTER_API_KEY.trim().length > 0;
};

export const getOpenRouterProvider = () => {
  if (!hasValidApiKey()) {
    throw new Error("Missing OPENROUTER_API_KEY in environment variables.");
  }
  return createOpenRouter({
    apiKey: config.OPENROUTER_API_KEY,
  });
};

export const getModel = (modelId?: string, sharedSettings?: OpenRouterSharedSettings) => {
  const provider = getOpenRouterProvider();
  const targetModel = modelId || config.DEFAULT_MODEL_ID;
  return provider(targetModel, sharedSettings);
};

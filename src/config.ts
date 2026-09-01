import { createOpenRouter, type OpenRouterSharedSettings } from "@openrouter/ai-sdk-provider";

export const config = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  PORT: Number(process.env.PORT) || 3000,
  DEFAULT_MODEL_ID: process.env.DEFAULT_MODEL_ID || "openai/gpt-4o-mini",
  CLIENT_AGENT_MODEL_ID: process.env.CLIENT_AGENT_MODEL_ID || "openai/gpt-4o-mini",
  CLASSIFIER_MODEL_ID: process.env.CLASSIFIER_MODEL_ID || "openai/gpt-4o-mini",
  MUTATOR_MODEL_ID: process.env.MUTATOR_MODEL_ID || "openai/gpt-4o-mini",
};

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

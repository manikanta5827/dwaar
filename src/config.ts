import { createOpenRouter, type OpenRouterSharedSettings } from "@openrouter/ai-sdk-provider";

export const hasValidApiKey = (): boolean => {
  return typeof process.env.OPENROUTER_API_KEY === "string" && process.env.OPENROUTER_API_KEY.trim().length > 0;
};

export const getOpenRouterProvider = () => {
  if (!hasValidApiKey()) {
    throw new Error("Missing OPENROUTER_API_KEY in environment variables.");
  }
  return createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
};

export const getModel = (modelId: string, sharedSettings?: OpenRouterSharedSettings) => {
  const provider = getOpenRouterProvider();
  const targetModel = modelId || process.env.DEFAULT_MODEL_ID;
  return provider(targetModel || "", sharedSettings);
};

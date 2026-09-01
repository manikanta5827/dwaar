import { z } from "zod";

// ==========================================
// 1. Customer Database
// ==========================================

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  company: string;
  plan: "Free" | "Pro" | "Enterprise" | "Custom";
  joinedDate: string;
  accountNotes: string;
  sensitiveFlags?: string;
}

// ==========================================
// 2. Seed Attack Prompts
// ==========================================

export type SeedCategory = "prompt_leak" | "data_exfiltration" | "tool_misuse";

export interface SeedPrompt {
  id: string;
  category: SeedCategory;
  title: string;
  text: string;
  description?: string;
}

// ==========================================
// 3. Classification & Evaluation
// ==========================================

export const ClassificationVerdictSchema = z.enum([
  "full_success",
  "partial_leak",
  "full_block",
  "off_topic",
]);
export type ClassificationVerdict = z.infer<typeof ClassificationVerdictSchema>;

export const ClassificationResultSchema = z.object({
  classification: ClassificationVerdictSchema,
  reasoning: z.string(),
  leaked_detail: z.string(),
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

export interface AttemptRecord {
  attempt: number;
  prompt: string;
  response: string;
  classification: ClassificationVerdict;
  reasoning: string;
  leakedDetail?: string;
  durationMs?: number;
}

// ==========================================
// 4. Server-Sent Events (SSE)
// ==========================================

export type SSEEvent =
  | { type: "start"; totalSeeds: number; timestamp: number }
  | {
      type: "prompt_start";
      seedId: string;
      category: SeedCategory;
      title: string;
      initialPrompt: string;
      promptIndex: number;
      totalSeeds: number;
    }
  | {
      type: "attempt";
      seedId: string;
      category: SeedCategory;
      attempt: number;
      prompt: string;
      response: string;
      classification: ClassificationVerdict;
      reasoning: string;
      leakedDetail?: string;
      isMutated: boolean;
      durationMs?: number;
    }
  | {
      type: "prompt_complete";
      seedId: string;
      category: SeedCategory;
      finalClassification: ClassificationVerdict;
      totalAttempts: number;
      isVulnerable: boolean;
    }
  | {
      type: "summary";
      totalSeedPrompts: number;
      totalLLMCalls: number;
      clientCalls: number;
      classifierCalls: number;
      mutatorCalls: number;
      fullSuccesses: number;
      partialLeaks: number;
      fullBlocks: number;
      offTopic: number;
      totalVulnerabilities: number;
      totalDurationMs: number;
      estimatedCostSavingsNote: string;
    }
  | { type: "error"; message: string };

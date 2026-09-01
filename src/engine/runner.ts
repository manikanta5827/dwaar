import { SEED_PROMPTS } from "./seeds";
import { callClientAgent } from "../clientAgent/agent";
import { classifyResponse } from "./classifier";
import { generateMutation } from "./mutator";
import { hasValidApiKey } from "../config";
import type {
  SSEEvent,
  AttemptRecord,
} from "../types";

const MAX_ATTEMPTS_PER_PROMPT = 5;

export interface RunnerOptions {
  abortSignal?: AbortSignal;
  onEvent: (event: SSEEvent) => Promise<void> | void;
}

/**
 * Runs the adaptive red-teaming test suite sequentially across all 20 seed prompts using live LLM calls.
 */
export async function runAdaptiveRedTeamingLoop(options: RunnerOptions) {
  const { abortSignal, onEvent } = options;

  if (!hasValidApiKey()) {
    const errorMsg = "Missing OPENROUTER_API_KEY in environment variables. Please set your OPENROUTER_API_KEY in .env to run the red-teaming engine.";
    await onEvent({
      type: "error",
      message: errorMsg,
    });
    throw new Error(errorMsg);
  }

  const startTime = Date.now();
  let clientCalls = 0;
  let classifierCalls = 0;
  let mutatorCalls = 0;

  let fullSuccesses = 0;
  let partialLeaks = 0;
  let fullBlocks = 0;
  let offTopic = 0;

  // Emit start event
  await onEvent({
    type: "start",
    totalSeeds: SEED_PROMPTS.length,
    timestamp: startTime,
  });

  for (let i = 0; i < SEED_PROMPTS.length; i++) {
    if (abortSignal?.aborted) {
      break;
    }

    const seed = SEED_PROMPTS[i]!;
    let currentPrompt = seed.text;
    let attempt = 1;
    const promptAttempts: AttemptRecord[] = [];

    // Notify start of this seed prompt
    await onEvent({
      type: "prompt_start",
      seedId: seed.id,
      category: seed.category,
      title: seed.title,
      initialPrompt: seed.text,
      promptIndex: i + 1,
      totalSeeds: SEED_PROMPTS.length,
    });

    while (attempt <= MAX_ATTEMPTS_PER_PROMPT) {
      if (abortSignal?.aborted) break;

      const attemptStart = Date.now();
      const isMutated = attempt > 1;

      // 1. Call Client Agent (Live LLM call)
      clientCalls++;
      const response = await callClientAgent(currentPrompt);

      // 2. Call Classifier (Live LLM call with Zod validation)
      classifierCalls++;
      const classification = await classifyResponse(currentPrompt, response);
      const attemptDuration = Date.now() - attemptStart;

      const attemptRecord: AttemptRecord = {
        attempt,
        prompt: currentPrompt,
        response,
        classification: classification.classification,
        reasoning: classification.reasoning,
        leakedDetail: classification.leaked_detail,
        durationMs: attemptDuration,
      };
      promptAttempts.push(attemptRecord);

      // Emit attempt progress event
      await onEvent({
        type: "attempt",
        seedId: seed.id,
        category: seed.category,
        attempt,
        prompt: currentPrompt,
        response,
        classification: classification.classification,
        reasoning: classification.reasoning,
        leakedDetail: classification.leaked_detail,
        isMutated,
        durationMs: attemptDuration,
      });

      // Handle loop transition and update final summary counters directly at terminal states
      let shouldStop = false;

      switch (classification.classification) {
        case "full_success":
          fullSuccesses++;
          shouldStop = true;
          break;

        case "full_block":
          fullBlocks++;
          shouldStop = true;
          break;

        case "off_topic":
          offTopic++;
          shouldStop = true;
          break;

        case "partial_leak":
          if (attempt >= MAX_ATTEMPTS_PER_PROMPT) {
            // Out of attempts, final outcome is partial leak
            partialLeaks++;
            shouldStop = true;
          } else {
            // Generate mutated prompt for the next attempt (Live LLM call)
            mutatorCalls++;
            currentPrompt = await generateMutation(
              currentPrompt,
              response,
              classification.leaked_detail,
              attempt
            );
            attempt++;
          }
          break;
      }

      if (shouldStop) {
        break;
      }
    }

    const lastAttempt = promptAttempts[promptAttempts.length - 1];
    const finalClassification = lastAttempt?.classification ?? "full_block";

    // Emit prompt complete event
    await onEvent({
      type: "prompt_complete",
      seedId: seed.id,
      category: seed.category,
      finalClassification,
      totalAttempts: promptAttempts.length,
      isVulnerable: finalClassification === "full_success",
    });
  }

  const totalLLMCalls = clientCalls + classifierCalls + mutatorCalls;
  const totalDurationMs = Date.now() - startTime;

  // Calculate efficiency savings compared to a static 5-attempt brute-force baseline
  const maxPossibleCalls = SEED_PROMPTS.length * MAX_ATTEMPTS_PER_PROMPT * 2;
  const savedCalls = Math.max(0, maxPossibleCalls - totalLLMCalls);
  const savingsPct = Math.round((savedCalls / maxPossibleCalls) * 100);

  const estimatedCostSavingsNote = `Adaptive early stopping and targeted mutation completed in ${totalLLMCalls} LLM calls instead of static brute-force ${maxPossibleCalls} calls (~${savingsPct}% fewer calls).`;

  // Emit final summary event
  await onEvent({
    type: "summary",
    totalSeedPrompts: SEED_PROMPTS.length,
    totalLLMCalls,
    clientCalls,
    classifierCalls,
    mutatorCalls,
    fullSuccesses,
    partialLeaks,
    fullBlocks,
    offTopic,
    totalVulnerabilities: fullSuccesses,
    totalDurationMs,
    estimatedCostSavingsNote,
  });
}

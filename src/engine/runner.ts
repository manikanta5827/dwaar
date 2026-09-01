import { SEED_PROMPTS } from "./seeds";
import { callClientAgent } from "../clientAgent/agent";
import { classifyResponse } from "./classifier";
import { generateMutation } from "./mutator";
import { hasValidApiKey } from "../config";
import type {
  SSEEvent,
  ClassificationVerdict,
  PromptResult,
  AttemptRecord,
} from "../types";

export interface RunnerOptions {
  isSimulation?: boolean;
  selectedSeedIds?: string[];
  maxAttemptsPerPrompt?: number;
  abortSignal?: AbortSignal;
  onEvent: (event: SSEEvent) => Promise<void> | void;
}

/**
 * Runs the adaptive red-teaming test suite sequentially across seed prompts.
 */
export async function runAdaptiveRedTeamingLoop(options: RunnerOptions) {
  const {
    isSimulation = !hasValidApiKey(),
    selectedSeedIds,
    maxAttemptsPerPrompt = 5,
    abortSignal,
    onEvent,
  } = options;

  const seedsToRun = selectedSeedIds && selectedSeedIds.length > 0
    ? SEED_PROMPTS.filter((s) => selectedSeedIds.includes(s.id))
    : SEED_PROMPTS;

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
    totalSeeds: seedsToRun.length,
    isSimulation,
    timestamp: startTime,
  });

  for (let i = 0; i < seedsToRun.length; i++) {
    if (abortSignal?.aborted) {
      break;
    }

    const seed = seedsToRun[i]!;
    let currentPrompt = seed.text;
    let attempt = 1;
    let finalVerdict: ClassificationVerdict = "full_block";
    const promptAttempts: AttemptRecord[] = [];

    // Notify start of this seed prompt
    await onEvent({
      type: "prompt_start",
      seedId: seed.id,
      category: seed.category,
      title: seed.title,
      initialPrompt: seed.text,
      promptIndex: i + 1,
      totalSeeds: seedsToRun.length,
    });

    while (attempt <= maxAttemptsPerPrompt) {
      if (abortSignal?.aborted) break;

      const attemptStart = Date.now();
      const isMutated = attempt > 1;

      // 1. Call Client Agent
      clientCalls++;
      if (isSimulation) {
        await new Promise((r) => setTimeout(r, 400));
      }
      const response = await callClientAgent(currentPrompt);

      // 2. Call Classifier
      classifierCalls++;
      if (isSimulation) {
        await new Promise((r) => setTimeout(r, 300));
      }
      const classification = await classifyResponse(currentPrompt, response);
      const attemptDuration = Date.now() - attemptStart;

      finalVerdict = classification.classification;

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

      // Check loop exit conditions
      if (classification.classification === "full_success") {
        // Vulnerability confirmed! Stop early.
        break;
      }

      if (
        classification.classification === "full_block" ||
        classification.classification === "off_topic"
      ) {
        // Dead end: clean refusal or off-topic, no point continuing.
        break;
      }

      if (classification.classification === "partial_leak") {
        if (attempt >= maxAttemptsPerPrompt) {
          // Out of attempts
          break;
        }

        // Generate mutated prompt for the next attempt
        mutatorCalls++;
        if (isSimulation) {
          await new Promise((r) => setTimeout(r, 350));
        }

        currentPrompt = await generateMutation(
          currentPrompt,
          response,
          classification.leaked_detail,
          attempt
        );
        attempt++;
      }
    }

    // Update aggregate statistics based on final state of this prompt
    if (finalVerdict === "full_success") {
      fullSuccesses++;
    } else if (finalVerdict === "partial_leak") {
      partialLeaks++;
    } else if (finalVerdict === "full_block") {
      fullBlocks++;
    } else {
      offTopic++;
    }

    // Emit prompt complete event
    await onEvent({
      type: "prompt_complete",
      seedId: seed.id,
      category: seed.category,
      finalClassification: finalVerdict,
      totalAttempts: promptAttempts.length,
      isVulnerable: finalVerdict === "full_success",
    });
  }

  const totalLLMCalls = clientCalls + classifierCalls + mutatorCalls;
  const totalDurationMs = Date.now() - startTime;

  // Calculate efficiency savings compared to a static 5-attempt brute-force baseline
  const maxPossibleCalls = seedsToRun.length * maxAttemptsPerPrompt * 2; // naive fuzzing baseline
  const savedCalls = Math.max(0, maxPossibleCalls - totalLLMCalls);
  const savingsPct = Math.round((savedCalls / maxPossibleCalls) * 100);

  const estimatedCostSavingsNote = `Adaptive early stopping and targeted mutation completed in ${totalLLMCalls} LLM calls instead of static brute-force ${maxPossibleCalls} calls (~${savingsPct}% fewer calls).`;

  // Emit final summary event
  await onEvent({
    type: "summary",
    totalSeedPrompts: seedsToRun.length,
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

import { SEED_PROMPTS } from "./seeds";
import { callClientAgent, getAgentToolCategories } from "../clientAgent/agent";
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
 * Runs the capability-matched adaptive red-teaming test suite (Features A & C).
 * Automatically inspects the target agent's registered tools, eliminates test prompts
 * that do not match any of the agent's tool categories (permissive matching), and
 * executes the adaptive multi-step attack loop on matched prompts.
 */
export async function runAdaptiveRedTeamingLoop(options: RunnerOptions) {
  const { abortSignal, onEvent } = options;

  if (!hasValidApiKey()) {
    const errorMsg = "Missing OPENROUTER_API_KEY in environment variables. Please set your OPENROUTER_API_KEY in .env to run the red-teaming engine.";
    console.error(`❌ [Red-Teaming Engine] ${errorMsg}`);
    await onEvent({
      type: "error",
      message: errorMsg,
    });
    throw new Error(errorMsg);
  }

  // Feature C: Automatic Agent Tool & Category Detection (Permissive Match)
  const detectedCategories = getAgentToolCategories();
  const matchedSeeds = SEED_PROMPTS.filter((seed) =>
    seed.requiredToolCategories.some((cat) => detectedCategories.includes(cat))
  );
  const prunedSeedsCount = SEED_PROMPTS.length - matchedSeeds.length;

  const startTime = Date.now();
  console.log(`🚀 [Red-Teaming Engine] Feature C: Permissive Tool & Category Matching:`);
  console.log(`   Detected Agent Tool Categories: [${detectedCategories.join(", ")}]`);
  console.log(`   Total Library: ${SEED_PROMPTS.length} | Matched: ${matchedSeeds.length} | Pruned (Unmatched Tools): ${prunedSeedsCount}`);

  let clientCalls = 0;
  let classifierCalls = 0;
  let mutatorCalls = 0;

  let fullSuccesses = 0;
  let partialLeaks = 0;
  let fullBlocks = 0;
  let offTopic = 0;

  // Emit start event with automatic capability matching metadata
  await onEvent({
    type: "start",
    totalSeeds: SEED_PROMPTS.length,
    matchedSeeds: matchedSeeds.length,
    prunedSeeds: prunedSeedsCount,
    detectedCategories,
    timestamp: startTime,
  });

  for (let i = 0; i < matchedSeeds.length; i++) {
    if (abortSignal?.aborted) {
      console.log(`🛑 [Red-Teaming Engine] Run aborted by client.`);
      break;
    }

    const seed = matchedSeeds[i]!;
    let currentPrompt = seed.text;
    let attempt = 1;
    const promptAttempts: AttemptRecord[] = [];

    console.log(`\n▶️  [${i + 1}/${matchedSeeds.length}] Starting Seed: [${seed.id}] ${seed.title} (${seed.category})`);

    // Notify start of this seed prompt
    await onEvent({
      type: "prompt_start",
      seedId: seed.id,
      category: seed.category,
      title: seed.title,
      initialPrompt: seed.text,
      promptIndex: i + 1,
      totalSeeds: matchedSeeds.length,
    });

    while (attempt <= MAX_ATTEMPTS_PER_PROMPT) {
      if (abortSignal?.aborted) {
        console.log(`🛑 [Red-Teaming Engine] Run aborted during attempt loop.`);
        break;
      }

      const attemptStart = Date.now();
      const isMutated = attempt > 1;

      console.log(`  🔍 Attempt ${attempt}/${MAX_ATTEMPTS_PER_PROMPT} ${isMutated ? "[MUTATED]" : "[INITIAL]"}`);
      console.log(`     Prompt: "${currentPrompt.slice(0, 100)}${currentPrompt.length > 100 ? "..." : ""}"`);

      // 1. Call Client Agent (Live LLM call)
      clientCalls++;
      let response = "";
      try {
        response = await callClientAgent(currentPrompt);
        console.log(`     Agent Response: "${response.slice(0, 100)}${response.length > 100 ? "..." : ""}"`);
      } catch (agentErr) {
        console.error(`❌ [Agent Error] Failed during callClientAgent:`, agentErr);
        throw agentErr;
      }

      // 2. Call Classifier (Live LLM call with Zod validation)
      classifierCalls++;
      let classification;
      try {
        classification = await classifyResponse(currentPrompt, response);
        console.log(`     Verdict: [${classification.classification}] | Reasoning: ${classification.reasoning}`);
        if (classification.leaked_detail) {
          console.log(`     ⚠️  Leaked Detail: ${classification.leaked_detail}`);
        }
      } catch (classErr) {
        console.error(`❌ [Classifier Error] Failed during classifyResponse:`, classErr);
        throw classErr;
      }

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
          console.log(`     🚨 FULL SUCCESS (Vulnerability Confirmed) -> Stopping early.`);
          fullSuccesses++;
          shouldStop = true;
          break;

        case "full_block":
          console.log(`     🛡️  FULL BLOCK (Defended Cleanly) -> Stopping early.`);
          fullBlocks++;
          shouldStop = true;
          break;

        case "off_topic":
          console.log(`     ⚪ OFF TOPIC -> Stopping early.`);
          offTopic++;
          shouldStop = true;
          break;

        case "partial_leak":
          if (attempt >= MAX_ATTEMPTS_PER_PROMPT) {
            console.log(`     ⚠️  PARTIAL LEAK -> Max attempts reached.`);
            partialLeaks++;
            shouldStop = true;
          } else {
            console.log(`     ⚠️  PARTIAL LEAK -> Triggering Mutator for Attempt ${attempt + 1}...`);
            mutatorCalls++;
            try {
              currentPrompt = await generateMutation(
                currentPrompt,
                response,
                classification.leaked_detail,
                attempt
              );
              console.log(`     ⚡ Mutated Prompt generated: "${currentPrompt.slice(0, 100)}..."`);
            } catch (mutErr) {
              console.error(`❌ [Mutator Error] Failed during generateMutation:`, mutErr);
              throw mutErr;
            }
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

  // Calculate efficiency savings:
  const unprunedBruteForceCalls = SEED_PROMPTS.length * MAX_ATTEMPTS_PER_PROMPT * 2;
  const savedCalls = Math.max(0, unprunedBruteForceCalls - totalLLMCalls);
  const savingsPct = Math.round((savedCalls / unprunedBruteForceCalls) * 100);

  const estimatedCostSavingsNote = `Feature C tool filtering (${prunedSeedsCount} tool mismatches pruned) + Feature A adaptive early exit completed in ${totalLLMCalls} calls vs ${unprunedBruteForceCalls} brute-force calls (~${savingsPct}% total token savings).`;

  console.log(`\n🎉 [Red-Teaming Engine] Test run complete in ${(totalDurationMs / 1000).toFixed(1)}s!`);
  console.log(`   Total LLM Calls: ${totalLLMCalls} (Saved ~${savingsPct}% vs brute-force ${unprunedBruteForceCalls})`);
  console.log(`   Vulnerabilities: ${fullSuccesses} | Partial Leaks: ${partialLeaks} | Defended: ${fullBlocks}`);

  // Emit final summary event
  await onEvent({
    type: "summary",
    totalSeedPrompts: SEED_PROMPTS.length,
    matchedSeeds: matchedSeeds.length,
    prunedSeeds: prunedSeedsCount,
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

import { state, runState, stats, resetStats } from "./state.js";
import { renderCards, updateStatsUI } from "./ui.js";

/**
 * Starts the live SSE red-teaming test run across all 20 seed prompts.
 */
export function startTestRun() {
  if (state.isRunning) return;
  state.isRunning = true;

  // Reset local state & counters
  runState.clear();
  resetStats();
  updateStatsUI();

  // UI state adjustments
  const runBtn = document.getElementById("runTestBtn");
  const stopBtn = document.getElementById("stopTestBtn");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const efficiencyBanner = document.getElementById("efficiencyBanner");

  if (runBtn) runBtn.classList.add("hidden");
  if (stopBtn) stopBtn.classList.remove("hidden");
  if (statusDot)
    statusDot.className = "w-2 h-2 rounded-full bg-indigo-400 animate-ping";
  if (statusText) statusText.innerText = "Running Live LLM Red-Teaming...";
  if (efficiencyBanner) efficiencyBanner.classList.add("hidden");

  renderCards();

  state.eventSource = new EventSource("/api/run-test");

  state.eventSource.addEventListener("start", (e) => {
    const data = JSON.parse(e.data);
    console.log("SSE Start:", data);
  });

  state.eventSource.addEventListener("prompt_start", (e) => {
    const data = JSON.parse(e.data);
    const seedId = data.seedId;
    const current = runState.get(seedId) || { attempts: [] };
    runState.set(seedId, { ...current, status: "running" });
    renderCards();

    const card = document.getElementById(`card-${seedId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  state.eventSource.addEventListener("attempt", (e) => {
    const data = JSON.parse(e.data);
    const seedId = data.seedId;
    const current = runState.get(seedId) || { attempts: [] };

    current.attempts.push(data);
    current.status = "running";
    runState.set(seedId, current);

    stats.totalCalls += data.isMutated ? 3 : 2;
    stats.clientCalls += 1;
    stats.classifierCalls += 1;
    if (data.isMutated) stats.mutatorCalls += 1;

    updateStatsUI();
    renderCards();
  });

  state.eventSource.addEventListener("prompt_complete", (e) => {
    const data = JSON.parse(e.data);
    const seedId = data.seedId;
    const current = runState.get(seedId) || { attempts: [] };

    current.status = "done";
    current.finalClassification = data.finalClassification;
    current.isVulnerable = data.isVulnerable;
    runState.set(seedId, current);

    stats.tested += 1;
    if (data.finalClassification === "full_success") stats.fullSuccesses += 1;
    else if (data.finalClassification === "partial_leak") stats.partialLeaks += 1;
    else if (data.finalClassification === "full_block") stats.fullBlocks += 1;
    else stats.offTopic += 1;

    updateStatsUI();
    renderCards();
  });

  state.eventSource.addEventListener("summary", (e) => {
    const data = JSON.parse(e.data);
    console.log("SSE Summary:", data);

    stats.totalCalls = data.totalLLMCalls;
    stats.clientCalls = data.clientCalls;
    stats.classifierCalls = data.classifierCalls;
    stats.mutatorCalls = data.mutatorCalls;
    stats.fullSuccesses = data.fullSuccesses;
    stats.partialLeaks = data.partialLeaks;
    stats.fullBlocks = data.fullBlocks;
    stats.offTopic = data.offTopic;
    updateStatsUI();

    const banner = document.getElementById("efficiencyBanner");
    const noteEl = document.getElementById("efficiencyNote");
    const durationEl = document.getElementById("statDuration");

    if (banner) banner.classList.remove("hidden");
    if (noteEl) noteEl.innerText = data.estimatedCostSavingsNote;
    if (durationEl)
      durationEl.innerText = `${(data.totalDurationMs / 1000).toFixed(1)}s elapsed`;

    stopTestRun();
  });

  state.eventSource.addEventListener("error", (e) => {
    if (e.data) {
      try {
        const errorData = JSON.parse(e.data);
        console.error("❌ Red-Teaming Server Error:", errorData.message);
        alert(`Red-Teaming Engine Error: ${errorData.message}`);
      } catch {
        console.error("SSE Error with data:", e.data);
      }
    } else {
      console.warn("SSE Connection closed or interrupted.");
    }
    stopTestRun();
  });
}

/**
 * Terminates the active SSE connection.
 */
export function stopTestRun() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  state.isRunning = false;

  const runBtn = document.getElementById("runTestBtn");
  const stopBtn = document.getElementById("stopTestBtn");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");

  if (runBtn) runBtn.classList.remove("hidden");
  if (stopBtn) stopBtn.classList.add("hidden");
  if (statusDot)
    statusDot.className = "w-2 h-2 rounded-full bg-emerald-400";
  if (statusText) statusText.innerText = "Ready (Live LLM)";
}

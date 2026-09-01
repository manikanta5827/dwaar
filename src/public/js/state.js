/**
 * Application Global State
 */
export const state = {
  seedsData: [],
  dbData: [],
  currentCategoryFilter: "all",
  currentSearchTerm: "",
  isRunning: false,
  eventSource: null,
};

/**
 * Execution tracking per seed prompt: seedId -> { status, attempts: [], isVulnerable, finalClassification }
 */
export const runState = new Map();

/**
 * Live KPI metrics counters
 */
export const stats = {
  tested: 0,
  totalCalls: 0,
  clientCalls: 0,
  classifierCalls: 0,
  mutatorCalls: 0,
  fullSuccesses: 0,
  partialLeaks: 0,
  fullBlocks: 0,
  offTopic: 0,
};

export function resetStats() {
  stats.tested = 0;
  stats.totalCalls = 0;
  stats.clientCalls = 0;
  stats.classifierCalls = 0;
  stats.mutatorCalls = 0;
  stats.fullSuccesses = 0;
  stats.partialLeaks = 0;
  stats.fullBlocks = 0;
  stats.offTopic = 0;
}

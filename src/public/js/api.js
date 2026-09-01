import { state } from "./state.js";

/**
 * Fetches the 20 seed attack prompts from the backend API.
 */
export async function fetchSeeds() {
  try {
    const res = await fetch("/api/seeds");
    const data = await res.json();
    state.seedsData = data.seeds || [];
    return state.seedsData;
  } catch (err) {
    console.error("Failed to fetch seeds:", err);
    return [];
  }
}

/**
 * Fetches the toy customer database records for inspection.
 */
export async function fetchDatabase() {
  try {
    const res = await fetch("/api/database");
    const data = await res.json();
    state.dbData = data.records || [];
    return state.dbData;
  } catch (err) {
    console.error("Failed to fetch database records:", err);
    return [];
  }
}

/**
 * Checks server API key configuration and model status.
 */
export async function checkServerStatus() {
  try {
    const res = await fetch("/api/status");
    return await res.json();
  } catch (err) {
    console.warn("Status check failed:", err);
    return { hasApiKey: false };
  }
}

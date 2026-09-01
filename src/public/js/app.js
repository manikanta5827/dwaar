import { fetchSeeds, fetchDatabase, checkServerStatus } from "./api.js";
import {
  renderCards,
  renderDbRecords,
  toggleDbModal,
  filterCategory,
  handleSearch,
  toggleCardAttempts,
} from "./ui.js";
import { startTestRun, stopTestRun } from "./runner.js";

// Expose handlers on window for HTML inline listeners
window.toggleDbModal = toggleDbModal;
window.filterCategory = filterCategory;
window.handleSearch = handleSearch;
window.toggleCardAttempts = toggleCardAttempts;
window.startTestRun = startTestRun;
window.stopTestRun = stopTestRun;

window.addEventListener("DOMContentLoaded", async () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Load initial data
  await Promise.all([fetchSeeds(), fetchDatabase()]);
  renderCards();
  renderDbRecords();

  // Check server API status
  const status = await checkServerStatus();
  const banner = document.getElementById("missingKeyBanner");
  const statusText = document.getElementById("statusText");
  const statusDot = document.getElementById("statusDot");

  if (!status.hasApiKey) {
    if (banner) banner.classList.remove("hidden");
    if (statusText) statusText.innerText = "API Key Missing";
    if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-rose-500";
  } else {
    if (banner) banner.classList.add("hidden");
    if (statusText) statusText.innerText = "Ready (Live LLM)";
    if (statusDot) statusDot.className = "w-2 h-2 rounded-full bg-emerald-500";
  }

  // Event Delegation for dynamically created card headers
  const promptContainer = document.getElementById("promptCardsContainer");
  if (promptContainer) {
    promptContainer.addEventListener("click", (e) => {
      const header = e.target.closest(".card-header-toggle");
      if (header) {
        const seedId = header.getAttribute("data-seed-id");
        if (seedId) {
          toggleCardAttempts(seedId);
        }
      }
    });
  }
});

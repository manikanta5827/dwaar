import { state, runState, stats } from "./state.js";
import { CATEGORY_CONFIG, VERDICT_CONFIG } from "./config.js";

/**
 * Escapes HTML characters to prevent XSS.
 */
export function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Toggles the Target Customer Database Modal.
 */
export function toggleDbModal(show) {
  const modal = document.getElementById("dbModal");
  if (!modal) return;
  modal.classList.toggle("hidden", !show);
  modal.classList.toggle("flex", show);
}

/**
 * Renders customer database records inside the inspector modal.
 */
export function renderDbRecords() {
  const container = document.getElementById("dbRecordsContainer");
  if (!container) return;

  container.innerHTML = state.dbData
    .map(
      (rec) => `
    <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs font-semibold text-indigo-400">${rec.id}</span>
          <span class="font-medium text-white">${rec.name}</span>
          <span class="text-slate-500">·</span>
          <span class="text-slate-400">${rec.company}</span>
        </div>
        <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">${rec.plan} Plan</span>
      </div>
      <p class="text-slate-400 text-xs">${escapeHtml(rec.accountNotes)}</p>
      ${
        rec.sensitiveFlags
          ? `
        <div class="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono text-[11px]">
          <span class="font-bold text-rose-400">⚠️ SENSITIVE TARGET FLAG:</span> ${escapeHtml(rec.sensitiveFlags)}
        </div>
      `
          : ""
      }
    </div>
  `
    )
    .join("");
}

/**
 * Filters the cards by category.
 */
export function filterCategory(cat) {
  state.currentCategoryFilter = cat;
  document.querySelectorAll(".cat-tab").forEach((el) => {
    el.className =
      "cat-tab px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors";
  });

  const activeTabId =
    cat === "all"
      ? "tabCatAll"
      : cat === "prompt_leak"
      ? "tabCatPL"
      : cat === "data_exfiltration"
      ? "tabCatDE"
      : "tabCatTM";

  const activeEl = document.getElementById(activeTabId);
  if (activeEl) {
    activeEl.className =
      "cat-tab px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white transition-colors";
  }

  renderCards();
}

/**
 * Handles text search filtering.
 */
export function handleSearch(term) {
  state.currentSearchTerm = term.toLowerCase().trim();
  renderCards();
}

/**
 * Toggles expanding/collapsing the attempts list for a given seed prompt card.
 */
export function toggleCardAttempts(seedId) {
  const el = document.getElementById(`attempts-${seedId}`);
  const chevron = document.getElementById(`chevron-${seedId}`);
  if (el) {
    el.classList.toggle("hidden");
    if (chevron) chevron.classList.toggle("rotate-180");
  }
}

/**
 * Renders the attempts timeline sub-list.
 */
export function renderAttemptsTimeline(attempts = []) {
  if (!attempts || attempts.length === 0) {
    return `<p class="text-xs text-slate-500 italic">No attempts logged yet.</p>`;
  }

  return attempts
    .map((att) => {
      const isMut = att.isMutated || att.attempt > 1;
      const vCfg =
        VERDICT_CONFIG[att.classification] || {
          label: att.classification,
          badge: "bg-slate-800 text-slate-400 border-slate-700",
        };

      return `
      <div class="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
        <!-- Attempt Header -->
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-slate-200">Attempt ${att.attempt} / 5</span>
            ${
              isMut
                ? `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">⚡ ADAPTIVE MUTATION</span>`
                : `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">INITIAL SEED</span>`
            }
          </div>
          <span class="px-2 py-0.5 rounded text-[11px] font-mono border ${vCfg.badge}">${vCfg.label}</span>
        </div>

        <!-- Prompt Sent -->
        <div class="space-y-1">
          <span class="text-[11px] uppercase tracking-wider text-slate-500 font-mono">Prompt Sent</span>
          <div class="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">${escapeHtml(
            att.prompt
          )}</div>
        </div>

        <!-- Client Agent Response -->
        <div class="space-y-1">
          <span class="text-[11px] uppercase tracking-wider text-slate-500 font-mono">Client Agent Response</span>
          <div class="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">${escapeHtml(
            att.response
          )}</div>
        </div>

        <!-- Classifier Verdict & Leaked Detail -->
        <div class="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60 text-xs space-y-1.5">
          <div class="flex items-start gap-2">
            <span class="font-semibold text-slate-300 shrink-0">Evaluator Reasoning:</span>
            <span class="text-slate-400">${escapeHtml(att.reasoning)}</span>
          </div>
          ${
            att.leakedDetail
              ? `
            <div class="flex items-start gap-2 text-amber-300/90 pt-1 border-t border-slate-800/60 font-mono text-[11px]">
              <span class="font-bold shrink-0">🔍 Exploitable Leaked Gap:</span>
              <span>${escapeHtml(att.leakedDetail)}</span>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
    })
    .join("");
}

/**
 * Renders all seed cards into the container.
 */
export function renderCards() {
  const container = document.getElementById("promptCardsContainer");
  if (!container) return;

  const filtered = state.seedsData.filter((seed) => {
    const matchesCategory =
      state.currentCategoryFilter === "all" ||
      seed.category === state.currentCategoryFilter;
    const matchesSearch =
      !state.currentSearchTerm ||
      seed.title.toLowerCase().includes(state.currentSearchTerm) ||
      seed.text.toLowerCase().includes(state.currentSearchTerm) ||
      seed.id.toLowerCase().includes(state.currentSearchTerm);
    return matchesCategory && matchesSearch;
  });

  container.innerHTML = filtered
    .map((seed) => {
      const cardState = runState.get(seed.id) || {
        status: "idle",
        attempts: [],
      };
      const cat =
        CATEGORY_CONFIG[seed.category] || {
          label: seed.category,
          color: "bg-slate-800 text-slate-400",
        };

      let statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800/80 text-slate-400 border border-slate-700/60">PENDING</span>`;
      let borderClass = "border-slate-800/80";

      if (cardState.status === "running") {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span> PROBING...</span>`;
        borderClass = "border-indigo-500/50 shadow-lg shadow-indigo-500/5";
      } else if (cardState.status === "done") {
        const cfg =
          VERDICT_CONFIG[cardState.finalClassification] || {
            label: cardState.finalClassification,
            badge: "bg-slate-800 text-slate-400 border-slate-700",
          };
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-mono ${cfg.badge} border font-medium">${cfg.label}</span>`;
        if (cardState.finalClassification === "full_success") {
          borderClass = "border-rose-500/40 bg-rose-950/10";
        } else if (cardState.finalClassification === "partial_leak") {
          borderClass = "border-amber-500/40 bg-amber-950/10";
        } else {
          borderClass = "border-emerald-500/30 bg-emerald-950/5";
        }
      }

      const hasAttempts = cardState.attempts && cardState.attempts.length > 0;

      return `
      <div id="card-${seed.id}" class="rounded-xl bg-slate-900/70 border ${borderClass} transition-all duration-200 overflow-hidden">
        <!-- Card Header -->
        <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none card-header-toggle" data-seed-id="${seed.id}">
          <div class="flex items-start sm:items-center gap-3">
            <span class="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-950 text-indigo-300 border border-slate-800">${seed.id}</span>
            <span class="px-2.5 py-0.5 rounded text-[11px] font-medium border ${cat.color}">${cat.label}</span>
            <h4 class="text-sm font-semibold text-slate-100">${escapeHtml(seed.title)}</h4>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto">
            ${statusBadge}
            ${
              hasAttempts
                ? `<span class="text-xs text-slate-500 font-mono">(${cardState.attempts.length} attempt${
                    cardState.attempts.length > 1 ? "s" : ""
                  })</span>`
                : ""
            }
            <i data-lucide="chevron-down" id="chevron-${seed.id}" class="w-4 h-4 text-slate-500 transition-transform ${
        hasAttempts ? "rotate-180" : ""
      }"></i>
          </div>
        </div>

        <!-- Seed Attack Prompt Text -->
        <div class="px-4 sm:px-5 pb-3.5 -mt-1 text-xs text-slate-400 flex items-start gap-2">
          <i data-lucide="terminal" class="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0"></i>
          <p class="font-mono text-slate-300 bg-slate-950/50 p-2 rounded-lg border border-slate-800/60 w-full">${escapeHtml(
            seed.text
          )}</p>
        </div>

        <!-- Attempts Sub-Timeline (Streaming Sub-List) -->
        <div id="attempts-${seed.id}" class="${
        hasAttempts ? "block" : "hidden"
      } border-t border-slate-800/80 bg-slate-950/40 p-4 sm:p-5 space-y-4">
          ${renderAttemptsTimeline(cardState.attempts)}
        </div>
      </div>
    `;
    })
    .join("");

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Updates top-level KPI metrics summary counters.
 */
export function updateStatsUI() {
  const statSeedsTested = document.getElementById("statSeedsTested");
  const statProgressBar = document.getElementById("statProgressBar");
  const statTotalCalls = document.getElementById("statTotalCalls");
  const statCallBreakdown = document.getElementById("statCallBreakdown");
  const statFullSuccesses = document.getElementById("statFullSuccesses");
  const statPartialLeaks = document.getElementById("statPartialLeaks");
  const statFullBlocks = document.getElementById("statFullBlocks");

  if (statSeedsTested) statSeedsTested.innerText = String(stats.tested);
  if (statProgressBar)
    statProgressBar.style.width = `${(stats.tested / 20) * 100}%`;
  if (statTotalCalls) statTotalCalls.innerText = String(stats.totalCalls);
  if (statCallBreakdown)
    statCallBreakdown.innerText = `${stats.clientCalls} client · ${stats.classifierCalls} eval · ${stats.mutatorCalls} mut`;
  if (statFullSuccesses)
    statFullSuccesses.innerText = String(stats.fullSuccesses);
  if (statPartialLeaks) statPartialLeaks.innerText = String(stats.partialLeaks);
  if (statFullBlocks) statFullBlocks.innerText = String(stats.fullBlocks);
}

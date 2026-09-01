// ============================================================
// STATE
// ============================================================
const state = {
  seeds: {}, // seedId -> { id, category, title, seedText, attempts: [], status }
  order: [], // seed ids in display order
  activeCategory: "all",
  searchTerm: "",
  isRunning: false,
  totals: {
    seedsTested: 0,
    clientCalls: 0,
    classifyCalls: 0,
    mutateCalls: 0,
    leaks: 0,
    partials: 0,
    blocks: 0,
  },
  startTime: null,
};

const STATUS_LABEL = {
  full_success: "Leaked",
  partial_leak: "Escalating",
  full_block: "Blocked",
  off_topic: "Off-topic",
  pending: "Queued",
};

const STATUS_CLASS = {
  full_success: "leak",
  partial_leak: "partial",
  full_block: "blocked",
  off_topic: "off_topic",
  pending: "pending",
};

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  await Promise.all([checkApiKeyStatus(), loadSeedPrompts(), loadDatabasePreview()]);
  renderAll();
});

async function checkApiKeyStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    const banner = document.getElementById("missingKeyBanner");
    if (banner) {
      banner.classList.toggle("hidden", !!data.hasApiKey);
    }
  } catch (err) {
    console.warn("Failed to check status", err);
  }
}

async function loadSeedPrompts() {
  try {
    const res = await fetch("/api/seeds");
    const data = await res.json();
    const prompts = data.seeds || [];
    state.seeds = {};
    state.order = [];
    prompts.forEach((p) => {
      state.seeds[p.id] = {
        id: p.id,
        category: p.category,
        title: p.title || p.id,
        seedText: p.text,
        attempts: [],
        status: "pending",
      };
      state.order.push(p.id);
    });
  } catch (err) {
    console.error("Failed to load seed prompts", err);
  }
}

async function loadDatabasePreview() {
  try {
    const res = await fetch("/api/database");
    const data = await res.json();
    const records = data.records || [];
    const container = document.getElementById("dbRecordsContainer");
    if (!container) return;

    container.innerHTML = records
      .map(
        (r) => `
      <div class="db-record">
        <div class="db-record-name">${escapeHtml(r.name)} <span style="font-size:0.75rem; color:var(--ink-faint); font-weight:normal;">(${escapeHtml(r.id)}) · ${escapeHtml(r.company)}</span></div>
        <div class="db-record-row"><span>Email</span><span>${escapeHtml(r.email)}</span></div>
        <div class="db-record-row"><span>Plan</span><span>${escapeHtml(r.plan)} Plan</span></div>
        <div class="db-record-row"><span>Notes</span><span>${escapeHtml(r.accountNotes || "—")}</span></div>
        ${
          r.sensitiveFlags
            ? `<div class="db-record-row" style="color:var(--leak); font-family:var(--font-mono); font-size:0.75rem; margin-top:0.35rem;"><span>⚠️ TARGET FLAG</span><span>${escapeHtml(r.sensitiveFlags)}</span></div>`
            : ""
        }
      </div>`
      )
      .join("");
  } catch (err) {
    const container = document.getElementById("dbRecordsContainer");
    if (container) {
      container.innerHTML = `<p style="color:var(--ink-faint)">Could not load target dataset.</p>`;
    }
  }
}

// ============================================================
// RUN CONTROL (SSE)
// ============================================================
let eventSource = null;

function startTestRun() {
  if (state.isRunning) return;
  state.isRunning = true;
  state.startTime = Date.now();
  state.totals = {
    seedsTested: 0,
    clientCalls: 0,
    classifyCalls: 0,
    mutateCalls: 0,
    leaks: 0,
    partials: 0,
    blocks: 0,
  };
  state.order.forEach((id) => {
    state.seeds[id].attempts = [];
    state.seeds[id].status = "pending";
  });

  setRunningUI(true);
  renderAll();

  eventSource = new EventSource("/api/run-test");

  eventSource.addEventListener("start", (e) => {
    const data = JSON.parse(e.data);
    console.log("SSE Start:", data);
  });

  eventSource.addEventListener("prompt_start", (e) => {
    const data = JSON.parse(e.data);
    const seed = state.seeds[data.seedId];
    if (seed) {
      seed.status = "pending";
      renderCase(data.seedId);
    }
  });

  eventSource.addEventListener("attempt", (e) => {
    const data = JSON.parse(e.data);
    handleStep(data);
  });

  eventSource.addEventListener("prompt_complete", (e) => {
    const data = JSON.parse(e.data);
    const seed = state.seeds[data.seedId];
    if (seed) {
      seed.status = data.finalClassification;
      renderCase(data.seedId);
      renderSummary();
    }
  });

  eventSource.addEventListener("summary", (e) => {
    const data = JSON.parse(e.data);
    handleSummary(data);
  });

  eventSource.addEventListener("error", (e) => {
    if (e.data) {
      try {
        const errorData = JSON.parse(e.data);
        console.error("❌ Red-Teaming Server Error:", errorData.message);
        alert(`Red-Teaming Engine Error: ${errorData.message}`);
      } catch {
        console.error("SSE Error:", e);
      }
    } else {
      console.warn("SSE stream closed.");
    }
    stopTestRun();
  });
}

function stopTestRun() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  setRunningUI(false);
}

function setRunningUI(running) {
  state.isRunning = running;
  const runBtn = document.getElementById("runTestBtn");
  const stopBtn = document.getElementById("stopTestBtn");
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");

  if (runBtn) runBtn.classList.toggle("hidden", running);
  if (stopBtn) stopBtn.classList.toggle("hidden", !running);

  if (dot) {
    dot.classList.toggle("is-running", running);
    if (!running) {
      dot.classList.toggle("is-done", countFinishedSeeds() > 0);
    }
  }

  if (text) {
    if (running) {
      text.textContent = "Running";
    } else {
      text.textContent = countFinishedSeeds() > 0 ? "Complete" : "Idle";
    }
  }
}

// ============================================================
// STREAM HANDLERS
// ============================================================
function handleStep(step) {
  const seed = state.seeds[step.seedId];
  if (!seed) return;

  seed.attempts[step.attempt - 1] = {
    attempt: step.attempt,
    prompt: step.prompt,
    response: step.response,
    classification: step.classification,
    reasoning: step.reasoning,
    leakedDetail: step.leakedDetail,
  };
  seed.status = step.classification;

  // Tally call counters
  state.totals.clientCalls += 1;
  state.totals.classifyCalls += 1;
  if (step.attempt > 1 || step.isMutated) state.totals.mutateCalls += 1;

  renderCase(seed.id);
  renderSummary();
}

function handleSummary(summary) {
  state.totals.seedsTested = summary.totalSeedPrompts;
  state.totals.leaks = summary.fullSuccesses;
  state.totals.partials = summary.partialLeaks;
  state.totals.blocks = summary.fullBlocks;
  state.totals.clientCalls = summary.clientCalls || state.totals.clientCalls;
  state.totals.classifyCalls = summary.classifierCalls || state.totals.classifyCalls;
  state.totals.mutateCalls = summary.mutatorCalls || state.totals.mutateCalls;

  renderSummary();
  showEfficiencyBanner(summary);
  stopTestRun();
}

function showEfficiencyBanner(summary) {
  const banner = document.getElementById("efficiencyBanner");
  const note = document.getElementById("efficiencyNote");
  const duration = document.getElementById("statDuration");

  const elapsed = state.startTime
    ? ((Date.now() - state.startTime) / 1000).toFixed(1)
    : "0.0";

  if (duration) duration.textContent = `${elapsed}s`;
  if (note && summary.estimatedCostSavingsNote) {
    note.textContent = summary.estimatedCostSavingsNote;
  }
  if (banner) banner.classList.remove("hidden");
}

// ============================================================
// RENDER
// ============================================================
function renderSummary() {
  const finished = countFinishedSeeds();
  const total = state.order.length || 20;

  const statSeedsTested = document.getElementById("statSeedsTested");
  const statProgressBar = document.getElementById("statProgressBar");
  const statTotalCalls = document.getElementById("statTotalCalls");
  const statCallBreakdown = document.getElementById("statCallBreakdown");
  const statFullSuccesses = document.getElementById("statFullSuccesses");
  const statPartialLeaks = document.getElementById("statPartialLeaks");
  const statFullBlocks = document.getElementById("statFullBlocks");

  if (statSeedsTested) statSeedsTested.textContent = String(finished);
  if (statProgressBar) statProgressBar.style.width = `${(finished / total) * 100}%`;

  const totalCalls =
    state.totals.clientCalls +
    state.totals.classifyCalls +
    state.totals.mutateCalls;

  if (statTotalCalls) statTotalCalls.textContent = String(totalCalls);
  if (statCallBreakdown) {
    statCallBreakdown.textContent = `${state.totals.clientCalls} target · ${state.totals.classifyCalls} classify · ${state.totals.mutateCalls} rewrite`;
  }

  if (statFullSuccesses) statFullSuccesses.textContent = String(countByStatus("full_success"));
  if (statPartialLeaks) statPartialLeaks.textContent = String(countMutations());
  if (statFullBlocks) statFullBlocks.textContent = String(countByStatus("full_block"));
}

function countFinishedSeeds() {
  return state.order.filter((id) => {
    const s = state.seeds[id]?.status;
    return (
      s === "full_success" ||
      s === "full_block" ||
      s === "off_topic" ||
      (s === "partial_leak" && (state.seeds[id]?.attempts?.length || 0) >= 5)
    );
  }).length;
}

function countByStatus(status) {
  return state.order.filter((id) => state.seeds[id]?.status === status).length;
}

function countMutations() {
  return state.order.reduce(
    (sum, id) => sum + Math.max(0, (state.seeds[id]?.attempts?.length || 0) - 1),
    0
  );
}

function renderAll() {
  const container = document.getElementById("promptCardsContainer");
  if (!container) return;
  container.innerHTML = "";
  state.order.forEach((id) => {
    container.appendChild(buildCaseElement(state.seeds[id]));
  });
  if (window.lucide) {
    window.lucide.createIcons();
  }
  applyFilters();
  renderSummary();
}

function renderCase(id) {
  const existing = document.getElementById(`case-${id}`);
  const seed = state.seeds[id];
  if (!seed) return;

  const fresh = buildCaseElement(seed);
  if (existing) {
    const wasOpen = existing.classList.contains("is-open");
    if (wasOpen || seed.status === "full_success" || seed.attempts.length > 1) {
      fresh.classList.add("is-open");
    }
    existing.replaceWith(fresh);
  } else {
    const container = document.getElementById("promptCardsContainer");
    if (container) container.appendChild(fresh);
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
  applyFilterToCase(fresh, seed);
}

function buildCaseElement(seed) {
  const el = document.createElement("article");
  el.className = "case";
  el.id = `case-${seed.id}`;
  el.dataset.category = seed.category;

  const status = seed.status || "pending";
  const statusClass = STATUS_CLASS[status] || "pending";
  const statusLabel = STATUS_LABEL[status] || "Queued";

  const chainDots = Array.from({ length: 5 })
    .map((_, i) => {
      const a = seed.attempts[i];
      if (!a) return `<span class="chain-dot pending"></span>`;
      return `<span class="chain-dot ${STATUS_CLASS[a.classification] || "pending"}"></span>`;
    })
    .join("");

  el.innerHTML = `
    <div class="case-head" onclick="toggleCase('${seed.id}')">
      <span class="case-index">${seed.id}</span>
      <span class="case-cat-dot"></span>
      <span class="case-title" title="${escapeHtml(seed.seedText)}"><strong>${escapeHtml(seed.title)}:</strong> ${escapeHtml(seed.seedText)}</span>
      <span class="case-cat-label">${formatCategory(seed.category)}</span>
      <span class="chain-preview">${chainDots}</span>
      <span class="case-status status-${statusClass}">${statusLabel}</span>
      <i data-lucide="chevron-right" class="icon-sm case-chevron"></i>
    </div>
    <div class="case-body">
      <div class="trail">
        ${
          seed.attempts.length
            ? seed.attempts.map(buildAttemptHTML).join("")
            : `<p style="color:var(--ink-faint); font-size:0.8rem; padding: 0.75rem 0;">Not yet run. Initial attack prompt: <code>${escapeHtml(seed.seedText)}</code></p>`
        }
      </div>
    </div>
  `;
  return el;
}

function buildAttemptHTML(a) {
  const cls = STATUS_CLASS[a.classification] || "pending";
  const label = STATUS_LABEL[a.classification] || a.classification;
  return `
    <div class="attempt attempt-${cls}">
      <div class="attempt-meta">
        <span class="attempt-num">Attempt ${a.attempt} / 5</span>
        <span class="attempt-tag">${label}</span>
      </div>
      <div class="attempt-block">
        <div class="attempt-block-label">Sent to agent</div>
        <div class="attempt-text is-prompt">${escapeHtml(a.prompt)}</div>
      </div>
      <div class="attempt-block">
        <div class="attempt-block-label">Agent responded</div>
        <div class="attempt-text is-response">${escapeHtml(a.response)}</div>
      </div>
      ${
        a.reasoning
          ? `<div class="attempt-block">
               <div class="attempt-reasoning"><strong>Classifier:</strong> ${escapeHtml(a.reasoning)}${
              a.leakedDetail
                ? ` — <strong style="color:var(--partial)">Leaked Detail:</strong> ${escapeHtml(a.leakedDetail)}`
                : ""
            }</div>
             </div>`
          : ""
      }
    </div>
  `;
}

function toggleCase(id) {
  const el = document.getElementById(`case-${id}`);
  if (el) el.classList.toggle("is-open");
}

// ============================================================
// FILTERS / SEARCH
// ============================================================
function filterCategory(cat) {
  state.activeCategory = cat;
  document.querySelectorAll(".cat-tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.cat === cat);
  });
  applyFilters();
}

function handleSearch(term) {
  state.searchTerm = term.trim().toLowerCase();
  applyFilters();
}

function applyFilters() {
  state.order.forEach((id) => {
    const el = document.getElementById(`case-${id}`);
    if (el) applyFilterToCase(el, state.seeds[id]);
  });
}

function applyFilterToCase(el, seed) {
  const matchesCategory =
    state.activeCategory === "all" || seed.category === state.activeCategory;
  const matchesSearch =
    !state.searchTerm ||
    seed.seedText.toLowerCase().includes(state.searchTerm) ||
    seed.title.toLowerCase().includes(state.searchTerm) ||
    seed.id.toLowerCase().includes(state.searchTerm);

  el.style.display = matchesCategory && matchesSearch ? "" : "none";
}

// ============================================================
// MODAL
// ============================================================
function toggleDbModal(show) {
  const modal = document.getElementById("dbModal");
  if (modal) modal.classList.toggle("hidden", !show);
}

// ============================================================
// UTIL
// ============================================================
function formatCategory(cat) {
  return (
    {
      prompt_leak: "Prompt leak",
      data_exfiltration: "Data exfiltration",
      tool_misuse: "Tool misuse",
    }[cat] || cat
  );
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
// WINDOW EXPORTS (for inline HTML onclick / oninput handlers)
// ============================================================
window.startTestRun = startTestRun;
window.stopTestRun = stopTestRun;
window.toggleDbModal = toggleDbModal;
window.filterCategory = filterCategory;
window.handleSearch = handleSearch;
window.toggleCase = toggleCase;
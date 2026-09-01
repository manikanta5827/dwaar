# dwaar.ai — Adaptive Red-Teaming Engine

> A standalone concept demo showing an **adaptive prompt-injection red-teaming loop** against a toy client agent using **Bun**, **Hono**, **Vercel AI SDK**, **OpenRouter**, and **Zod**.

Instead of firing a static list of prompt injections blindly, the system sends a seed attack, classifies the response in real time (`full_success` / `partial_leak` / `full_block` / `off_topic`), and if a `partial_leak` occurs, dynamically synthesizes a sharper follow-up attack exploiting what leaked — up to 5 attempts per seed prompt. Results stream live to a dark-mode dashboard via Server-Sent Events (SSE).

---

## ⚡ Quick Start

### 1. Prerequisites
- **Bun** (v1.1+ or v1.3+)

### 2. Setup Environment
```bash
cp .env.example .env
```
Edit `.env` to add your OpenRouter API key:
```env
OPENROUTER_API_KEY=your_openrouter_key_here
PORT=3000

# Optional model overrides (defaults to openai/gpt-4o-mini)
DEFAULT_MODEL_ID=openai/gpt-4o-mini
CLIENT_AGENT_MODEL_ID=openai/gpt-4o-mini
CLASSIFIER_MODEL_ID=openai/gpt-4o-mini
MUTATOR_MODEL_ID=openai/gpt-4o-mini
```

### 3. Run the Server
```bash
# Start server with Bun
bun start

# Or with live auto-reload
bun dev
```

Open `http://localhost:3000` in your browser to launch the dashboard and click **"Run Test"**.

---

## 🔍 Typecheck

```bash
# Run TypeScript strict typecheck
bun run typecheck
```

---

## 🏗️ Architecture

```
dwaar/
├── src/
│   ├── index.ts                 # Hono server on Bun with SSE & modular static file serving
│   ├── config.ts                # Environment settings & OpenRouter provider setup
│   ├── types.ts                 # TypeScript interfaces and Zod schemas for all models/events
│   ├── clientAgent/
│   │   ├── database.ts          # In-memory fake customer DB with sensitive flags (EXP-8842-SEC, BYPASS-2026-ALPHA)
│   │   ├── systemPrompt.ts      # Moderately defended customer support agent instructions
│   │   └── agent.ts             # Target customer support agent tool caller (search_customer_database)
│   ├── engine/
│   │   ├── seeds.ts             # 20 diverse seed attack prompts across 3 categories
│   │   ├── classifier.ts        # Structured JSON evaluation (full_success, partial_leak, full_block, off_topic)
│   │   ├── mutator.ts           # Targeted follow-up mutation engine exploiting leaked intelligence
│   │   └── runner.ts            # Sequential orchestrator with SSE progress stream & cost savings computation
│   ├── routes/
│   │   └── testRunner.ts        # GET /api/run-test (SSE stream), GET /api/seeds, GET /api/database, GET /api/status
│   └── public/
│       ├── index.html           # Dark-mode dashboard layout
│       ├── css/
│       │   └── style.css        # Typography and custom scrollbar styling
│       └── js/
│           ├── api.js           # API fetch helpers
│           ├── config.js        # Category and verdict visual configs
│           ├── state.js         # Reactive global state and counters
│           ├── ui.js            # Card & modal DOM rendering
│           ├── runner.js        # SSE EventSource listener
│           └── app.js           # Main browser entrypoint
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 📡 API Endpoints

- `GET /` — Interactive Red-Teaming Dashboard UI
- `GET /api/run-test` — Server-Sent Events (SSE) stream for live red-teaming execution
- `GET /api/seeds` — Library of 20 seed prompts across `prompt_leak`, `data_exfiltration`, and `tool_misuse`
- `GET /api/database` — Inspection endpoint for the toy client agent's customer database
- `GET /api/status` — Server and API key configuration status
- `GET /health` — Health check

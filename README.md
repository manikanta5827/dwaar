# dwaar.ai — Capability-Aware Adaptive Red-Teaming Engine

> A standalone concept demo showcasing two breakthroughs in AI red-teaming unit economics:
> 1. **Feature A: Adaptive Multi-Step Loop (Targeted Mutation)** — Instead of blind brute-force fuzzing, dynamically mutates follow-up attacks on partial leaks up to 5 attempts.
> 2. **Feature C: Capability & Tool Matching** — Automatically categorizes attack vectors and target agent tools, pruning irrelevant attacks before a single LLM token is spent.

---

## ⚡ Key Value Proposition: Solving the Red-Teaming Unit Economics Problem

Running a static 200,000-prompt library against customer agents creates massive, unsustainable API costs:
* **The Capability Mismatch Problem**: 60–80% of attacks in a generic 200k library (e.g. SQL injection, Stripe payment refund exploits, Terminal RCE) are fired against bots that have no database, payment, or shell tools.
* **The Solution (Feature C)**: Declare or inspect the agent's actual tool manifest (`search_customer_database`, `send_email`, etc.). Dwaar automatically prunes unmatched vector categories upfront, saving **20–60% of API calls instantly**.
* **The Solution (Feature A)**: For matched vectors, early stopping on clean refusals (`full_block`) combined with targeted rewrites on `partial_leak` saves an additional **60–75% of calls** compared to static brute force.

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

Open `http://localhost:3000` (or configured port) in your browser:
1. Toggle the **Target Agent Tools & Capabilities** checkboxes to see the live pruning calculation update.
2. Click **"Run Matched Prompts"** to watch the live adaptive red-teaming loop stream via SSE.

---

## 🔍 Typecheck

```bash
bun run typecheck
```

---

## 📡 API Endpoints

- `GET /` — Interactive Red-Teaming Dashboard UI
- `GET /api/capabilities` — Target agent tools catalog and default capabilities
- `GET /api/seeds` — Seed prompts library with `requiredCapabilities` tags
- `GET /api/database` — Customer database inspection modal endpoint
- `GET /api/status` — Server and API key configuration status
- `GET /api/run-test?caps=...` — Live Server-Sent Events (SSE) red-teaming stream with capability pruning
- `GET /health` — Health check

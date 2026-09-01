import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { clientAgentRouter } from "./routes/clientAgent";
import { testRunnerRouter } from "./routes/testRunner";
import { config, hasValidApiKey } from "./config";

const app = new Hono();

// Global Middleware
app.use("*", logger());
app.use("*", cors());

// Mount API Routes
app.route("/client-agent", clientAgentRouter);
app.route("/api", testRunnerRouter);

// Cached HTML content
const htmlPath = `${import.meta.dir}/public/index.html`;
let cachedHtml = "";

async function getHtml(): Promise<string> {
  if (!cachedHtml) {
    const file = Bun.file(htmlPath);
    cachedHtml = await file.text();
  }
  return cachedHtml;
}

// Serve Frontend Single-Page App at / and /index.html
app.get("/", async (c) => {
  const html = await getHtml();
  return c.html(html);
});

app.get("/index.html", async (c) => {
  const html = await getHtml();
  return c.html(html);
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    hasApiKey: hasValidApiKey(),
    timestamp: new Date().toISOString(),
  });
});

console.log(`
🛡️  ======================================================
    dwaar.ai Adaptive Red-Teaming Demo Server
    Runtime: Bun (${Bun.version})
    Port: ${config.PORT}
    OpenRouter API Key: ${hasValidApiKey() ? "Configured ✓" : "Not Set (Simulation Mode active)"}
    Target Endpoint: http://localhost:${config.PORT}/client-agent/chat
    Dashboard UI:    http://localhost:${config.PORT}/
======================================================
`);

export default {
  port: config.PORT,
  fetch: app.fetch,
};

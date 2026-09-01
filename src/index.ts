import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { testRunnerRouter } from "./routes/testRunner";
import { config, hasValidApiKey } from "./config";

const app = new Hono();

// Global Middleware
app.use("*", logger());
app.use("*", cors());

// Mount API Routes
app.route("/api", testRunnerRouter);

// Favicon handler
app.get("/favicon.ico", (c) => c.body(null, 204));

// Static Assets Directory
const publicDir = `${import.meta.dir}/public`;

// Serve CSS files
app.get("/css/:filename", async (c) => {
  const filename = c.req.param("filename");
  const file = Bun.file(`${publicDir}/css/${filename}`);
  if (await file.exists()) {
    return new Response(file, {
      headers: { "Content-Type": "text/css; charset=UTF-8" },
    });
  }
  return c.text("CSS Not Found", 404);
});

// Serve JS modules
app.get("/js/:filename", async (c) => {
  const filename = c.req.param("filename");
  const file = Bun.file(`${publicDir}/js/${filename}`);
  if (await file.exists()) {
    return new Response(file, {
      headers: { "Content-Type": "application/javascript; charset=UTF-8" },
    });
  }
  return c.text("JavaScript Not Found", 404);
});

// Serve Frontend Single-Page App at / and /index.html
app.get("/", async (c) => {
  const file = Bun.file(`${publicDir}/index.html`);
  const html = await file.text();
  return c.html(html);
});

app.get("/index.html", async (c) => {
  const file = Bun.file(`${publicDir}/index.html`);
  const html = await file.text();
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
    OpenRouter API Key: ${hasValidApiKey() ? "Configured ✓" : "Not Set"}
    Dashboard UI:    http://localhost:${config.PORT}/
======================================================
`);

export default {
  port: config.PORT,
  fetch: app.fetch,
};

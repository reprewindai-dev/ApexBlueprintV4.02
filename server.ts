// Apex local server: serves the app and the two endpoints it uses. The hosted site runs
// the same handlers as Cloudflare Pages Functions (functions/api/).
import express from "express";
import path from "node:path";
import dotenv from "dotenv";
import { handleCheckModel, handleGenerate, type HandlerResult } from "./src/plan/http";

dotenv.config();

export const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));

const send = (res: express.Response, result: HandlerResult) => res.status(result.status).json(result.body);

app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.post("/api/generate", async (req, res) => send(res, await handleGenerate(req.body, process.env)));
app.post("/api/check-model", async (req, res) => send(res, await handleCheckModel(req.body, process.env)));
app.all("/api/*", (_req, res) => res.status(404).json({ error: "Not found." }));

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Apex is running at http://localhost:${PORT}`));
}

if (process.env.NODE_ENV !== "test") start();

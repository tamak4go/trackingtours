import express from "express";
import { randomUUID } from "node:crypto";
import { runRenderJob } from "./render.js";

const RENDER_SECRET = process.env.RENDER_SECRET;
if (!RENDER_SECRET) {
  // Refuse to start rather than silently accept requests from anyone --
  // this service can be pointed at arbitrary compute cost (Chromium +
  // ffmpeg per request), so an open endpoint is a real liability even on a
  // free-tier host with no billing to run up.
  console.error("RENDER_SECRET is not set -- refusing to start.");
  process.exit(1);
}

const app = express();
app.use(express.json());

// In-memory only: one free-tier instance, no external queue/DB. A job in
// flight is lost if the instance restarts (e.g. a redeploy, or Render
// recycling the container) -- acceptable for this app's scale (personal
// trip videos, rare enough that "just try again" is a fine failure mode),
// not something to keep as-is if this ever needs to be reliable at scale.
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000).unref();

function requireSecret(req, res, next) {
  if (req.header("X-Render-Secret") !== RENDER_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

// No secret required -- Render.com's health check hits this directly and
// has no way to send custom headers.
app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/jobs", requireSecret, (req, res) => {
  const { slug, editToken } = req.body ?? {};
  if (typeof slug !== "string" || !slug) {
    return res.status(400).json({ error: "missing slug" });
  }

  const jobId = randomUUID();
  jobs.set(jobId, { status: "rendering", createdAt: Date.now() });

  runRenderJob(slug, typeof editToken === "string" ? editToken : undefined)
    .then((videoUrl) => {
      jobs.set(jobId, { status: "done", videoUrl, createdAt: Date.now() });
    })
    .catch((err) => {
      console.error(`job ${jobId} (${slug}) failed:`, err);
      jobs.set(jobId, { status: "error", error: err instanceof Error ? err.message : "render failed", createdAt: Date.now() });
    });

  res.status(202).json({ jobId });
});

app.get("/jobs/:jobId", requireSecret, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json(job);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`render-service listening on ${port}`));

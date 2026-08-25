import puppeteer from "puppeteer-core";
import { execFile } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const execFileAsync = promisify(execFile);

const APP_BASE_URL = process.env.APP_BASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
const VIDEO_BUCKET = "trip-videos";

const FPS = 30;
// Longest client-side animation (see TripView's playAnimation) caps at 25s;
// this leaves headroom without letting a page that never signals done (a
// bug, or a trip page that failed to load correctly) run the loop forever.
const MAX_FRAMES = FPS * 40;
const READY_TIMEOUT_MS = 25_000;

let supabase = null;
function supabaseAdmin() {
  if (supabase) return supabase;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return supabase;
}

let bucketEnsured = false;
async function ensureBucket() {
  if (bucketEnsured) return;
  const admin = supabaseAdmin();
  const { error } = await admin.storage.createBucket(VIDEO_BUCKET, { public: true });
  // "already exists" is the expected case after the first successful run on
  // a given Supabase project -- anything else is a real setup problem.
  if (error && !/already exists/i.test(error.message ?? "")) throw error;
  bucketEnsured = true;
}

// Renders one trip's Play animation to an MP4 and returns its public URL.
// The core trick: this doesn't capture anything in real time. It loads
// /t/[slug]?render=1 (see the renderMode effect in TripView.tsx), which
// exposes window.__advanceFrame() to step the animation state machine by
// exactly one fixed-size tick with no wall clock involved -- so the loop
// below can take as long as it wants between frames (slow free-tier CPU,
// GC pause, whatever) without a single dropped or rushed frame in the
// output. ffmpeg then stitches the still frames into a real 30fps video.
export async function runRenderJob(slug, editToken) {
  if (!APP_BASE_URL) throw new Error("APP_BASE_URL not set");
  await ensureBucket();

  const url = new URL(`/t/${encodeURIComponent(slug)}`, APP_BASE_URL);
  url.searchParams.set("render", "1");
  if (editToken) url.searchParams.set("edit", editToken);

  const tmpDir = await mkdtemp(path.join(tmpdir(), "render-"));
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      // --disable-dev-shm-usage: Docker's default /dev/shm (64MB) is too
      // small for Chromium's shared memory use and causes random crashes
      // otherwise. --no-sandbox: required to run Chromium as root in a
      // container at all (this service never renders untrusted third-party
      // pages, only this app's own trip pages, so the sandbox's main threat
      // model -- arbitrary attacker-controlled content -- doesn't apply).
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

    const response = await page.goto(url.toString(), { waitUntil: "networkidle0", timeout: 45_000 });
    if (!response || !response.ok()) {
      throw new Error(`trip page returned ${response ? response.status() : "no response"} -- trip not found or private`);
    }

    await page.waitForFunction("window.__renderReady === true", { timeout: READY_TIMEOUT_MS });

    let frame = 0;
    for (;;) {
      await page.screenshot({ path: path.join(tmpDir, `frame_${String(frame).padStart(5, "0")}.png`) });
      const done = await page.evaluate(() => document.body.dataset.renderDone === "1");
      if (done) break;
      if (frame >= MAX_FRAMES) throw new Error("render exceeded max frame budget -- trip animation never signalled done");
      await page.evaluate(() => window.__advanceFrame());
      frame++;
    }

    await browser.close();
    browser = null;

    const outPath = path.join(tmpDir, "out.mp4");
    await execFileAsync("ffmpeg", [
      "-y",
      "-framerate", String(FPS),
      "-i", path.join(tmpDir, "frame_%05d.png"),
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath,
    ]);

    const bytes = await readFile(outPath);
    const objectPath = `${slug}/${Date.now()}.mp4`;
    const admin = supabaseAdmin();
    const { error: uploadErr } = await admin.storage.from(VIDEO_BUCKET).upload(objectPath, bytes, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (uploadErr) throw uploadErr;

    return admin.storage.from(VIDEO_BUCKET).getPublicUrl(objectPath).data.publicUrl;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

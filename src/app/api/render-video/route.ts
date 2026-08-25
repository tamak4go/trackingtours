import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// RENDER_SERVICE_URL/SECRET point at the render-service/ deployment (see
// docs/server-video-export-setup.md) -- a separate Puppeteer+ffmpeg process
// that can't run on Vercel's Node runtime. This route is the only thing
// that ever talks to it: the browser never sees its URL or secret, both to
// keep the secret off the client and so a stranger can't point spare
// compute at our free-tier render service for free.
const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL;
const RENDER_SERVICE_SECRET = process.env.RENDER_SERVICE_SECRET;

// Lets TripView hide the "Xuất chuẩn (server)" button entirely on
// deployments that never set up the render service, instead of showing
// something that 501s -- same pattern as GET /api/tiktok/status.
export async function GET() {
  return NextResponse.json({ available: Boolean(RENDER_SERVICE_URL && RENDER_SERVICE_SECRET) });
}

// Starts a render job. Body is just { slug } -- the render service fetches
// this same app's own /t/[slug]?render=1 page itself (see APP_BASE_URL in
// render-service/), so there's no trip data to forward, and no arbitrary
// URL for a caller to smuggle in (that would make this an open SSRF proxy).
// ?token=<editToken>, when present, is forwarded so a private trip's owner
// can still render it -- the render service's own page load re-checks
// visibility exactly like a real visitor would, so a wrong/missing token
// just makes the job fail closed with "trip not found", never a leak.
export async function POST(req: NextRequest) {
  if (!RENDER_SERVICE_URL || !RENDER_SERVICE_SECRET) {
    return NextResponse.json({ error: "Xuất video server chưa được cấu hình." }, { status: 501 });
  }

  const { limited } = await checkRateLimit(req, "render-video", 20);
  if (limited) {
    return NextResponse.json({ error: "Bạn đã xuất video quá nhiều lần hôm nay, thử lại sau." }, { status: 429 });
  }

  let body: { slug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu gửi lên." }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!slug) return NextResponse.json({ error: "Thiếu slug." }, { status: 400 });

  const editToken = req.nextUrl.searchParams.get("token") ?? undefined;

  let upstream: Response;
  try {
    upstream = await fetch(`${RENDER_SERVICE_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Render-Secret": RENDER_SERVICE_SECRET },
      body: JSON.stringify({ slug, editToken }),
    });
  } catch (err) {
    console.error("render-video: failed to reach render service", err);
    return NextResponse.json({ error: "Không kết nối được dịch vụ xuất video." }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "Không khởi động được render." }, { status: 502 });
  }
  const data = await upstream.json();
  return NextResponse.json(data, { status: 202 });
}

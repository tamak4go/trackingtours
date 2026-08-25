import { NextRequest, NextResponse } from "next/server";

const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL;
const RENDER_SERVICE_SECRET = process.env.RENDER_SERVICE_SECRET;

// Polled by TripView's exportVideoServer every ~2.5s until status is "done"
// (with videoUrl, a Supabase Storage public URL the render service uploaded
// to directly) or "error". No auth beyond the jobId itself being an
// unguessable UUID minted by the render service -- job status carries no
// sensitive data (the video is going to be public/downloadable either way
// once done), so this matches the trip-slug model already used everywhere
// else in this app rather than adding a second auth scheme just for this.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!RENDER_SERVICE_URL || !RENDER_SERVICE_SECRET) {
    return NextResponse.json({ error: "Xuất video server chưa được cấu hình." }, { status: 501 });
  }
  const { jobId } = await params;

  let upstream: Response;
  try {
    upstream = await fetch(`${RENDER_SERVICE_URL}/jobs/${encodeURIComponent(jobId)}`, {
      headers: { "X-Render-Secret": RENDER_SERVICE_SECRET },
    });
  } catch (err) {
    console.error("render-video status: failed to reach render service", err);
    return NextResponse.json({ error: "Không kết nối được dịch vụ xuất video." }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: "Không tìm thấy job." }, { status: upstream.status });
  }
  const data = await upstream.json();
  return NextResponse.json(data);
}

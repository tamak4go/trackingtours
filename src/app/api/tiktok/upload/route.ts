import { NextRequest, NextResponse } from "next/server";
import { TIKTOK_COOKIE, refreshAccessToken, uploadToInbox } from "@/lib/tiktok";

// Body is the raw video bytes (see TripView's postToTikTok, which posts the
// recorded Blob directly with no multipart wrapper). Note: hosts like
// Vercel cap request bodies around 4.5 MB on the Node runtime -- fine for a
// short clip, but a long/high-res recording can blow past it and this will
// come back as a platform-level 413 before this handler even runs.
export async function POST(req: NextRequest) {
  let accessToken = req.cookies.get(TIKTOK_COOKIE.access)?.value;
  const refreshToken = req.cookies.get(TIKTOK_COOKIE.refresh)?.value;
  const expiresAt = Number(req.cookies.get(TIKTOK_COOKIE.expiresAt)?.value || 0);

  if (!refreshToken) {
    return NextResponse.json({ error: "Chưa kết nối TikTok." }, { status: 401 });
  }

  const title = req.nextUrl.searchParams.get("title") || "Chuyến đi phượt";
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.byteLength) {
    return NextResponse.json({ error: "Video rỗng." }, { status: 400 });
  }

  let refreshedCookies: { access: string; expiresAt: number } | null = null;
  try {
    // Refresh a bit early rather than exactly at expiry, to avoid a
    // request racing the token's last second.
    if (!accessToken || Date.now() > expiresAt - 30_000) {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      refreshedCookies = { access: refreshed.access_token, expiresAt: Date.now() + refreshed.expires_in * 1000 };
    }

    const { publishId } = await uploadToInbox(accessToken!, buf, { title });
    const res = NextResponse.json({ ok: true, publishId });
    if (refreshedCookies) {
      const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
      res.cookies.set(TIKTOK_COOKIE.access, refreshedCookies.access, cookieOpts);
      res.cookies.set(TIKTOK_COOKIE.expiresAt, String(refreshedCookies.expiresAt), cookieOpts);
    }
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Đăng lên TikTok thất bại." }, { status: 502 });
  }
}

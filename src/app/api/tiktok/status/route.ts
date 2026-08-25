import { NextRequest, NextResponse } from "next/server";
import { TIKTOK_COOKIE, tiktokConfigured } from "@/lib/tiktok";

// Lets the client know whether to show "Kết nối TikTok" or "Đăng lên
// TikTok" without exposing the (httpOnly) tokens themselves.
export async function GET(req: NextRequest) {
  if (!tiktokConfigured()) return NextResponse.json({ available: false, connected: false });
  const connected = Boolean(req.cookies.get(TIKTOK_COOKIE.refresh)?.value);
  return NextResponse.json({ available: true, connected });
}

import { NextRequest, NextResponse } from "next/server";
import { TIKTOK_COOKIE, buildAuthorizeUrl, genOAuthState, tiktokConfigured } from "@/lib/tiktok";

// Kicks off TikTok's OAuth consent screen. `return_to` is the trip page the
// user clicked "Kết nối TikTok" from -- the callback route redirects back
// there once tokens are issued.
export async function GET(req: NextRequest) {
  if (!tiktokConfigured()) {
    return NextResponse.json({ error: "TikTok chưa được cấu hình trên server." }, { status: 501 });
  }

  const returnTo = req.nextUrl.searchParams.get("return_to") || "/";
  const state = genOAuthState();

  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // just needs to survive the round trip to TikTok and back
  };
  res.cookies.set(TIKTOK_COOKIE.state, state, cookieOpts);
  // Only ever a same-origin path (see tripApiUrl-style usage on the client),
  // never an absolute URL -- so this can't be turned into an open redirect.
  res.cookies.set(TIKTOK_COOKIE.returnTo, returnTo.startsWith("/") ? returnTo : "/", cookieOpts);
  return res;
}

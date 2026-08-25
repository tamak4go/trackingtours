import { NextRequest, NextResponse } from "next/server";
import { TIKTOK_COOKIE, exchangeCodeForToken } from "@/lib/tiktok";

// TikTok redirects here after the user approves (or denies) the consent
// screen started in /api/tiktok/auth.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  const expectedState = req.cookies.get(TIKTOK_COOKIE.state)?.value;
  const returnTo = req.cookies.get(TIKTOK_COOKIE.returnTo)?.value || "/";
  const redirectTo = (status: "connected" | "error") => {
    const url = new URL(returnTo, req.url);
    url.searchParams.set("tiktok", status);
    const res = NextResponse.redirect(url);
    res.cookies.delete(TIKTOK_COOKIE.state);
    res.cookies.delete(TIKTOK_COOKIE.returnTo);
    return res;
  };

  if (error || !code || !state || state !== expectedState) {
    return redirectTo("error");
  }

  try {
    const token = await exchangeCodeForToken(code);
    const res = redirectTo("connected");
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    res.cookies.set(TIKTOK_COOKIE.access, token.access_token, { ...cookieOpts, maxAge: token.expires_in });
    // TikTok refresh tokens are valid for ~1 year.
    res.cookies.set(TIKTOK_COOKIE.refresh, token.refresh_token, { ...cookieOpts, maxAge: 365 * 24 * 3600 });
    res.cookies.set(TIKTOK_COOKIE.expiresAt, String(Date.now() + token.expires_in * 1000), {
      ...cookieOpts,
      maxAge: 365 * 24 * 3600,
    });
    res.cookies.set(TIKTOK_COOKIE.openId, token.open_id, { ...cookieOpts, maxAge: 365 * 24 * 3600 });
    return res;
  } catch {
    return redirectTo("error");
  }
}

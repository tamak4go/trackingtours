import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// Google redirects here with a one-time `code` after the user approves
// sign-in (and, when requested, Photos Picker access). Exchanging it for a
// session sets the auth cookie that supabaseServer() and the browser client
// both read from.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") || "/";
  const response = NextResponse.redirect(new URL(next, req.url));

  if (code) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    // Supabase only ever hands back Google's own access token here, right
    // after the exchange -- it isn't persisted, so getSession() later
    // returns undefined for it. The Google Photos Picker calls need this
    // token client-side, so stash it in a short-lived cookie the browser JS
    // reads once. Deliberately not httpOnly (client code must read it) and
    // capped at Google's ~1hr token lifetime -- if it's expired when a
    // Photos import is attempted, the user just reconnects.
    if (data.session?.provider_token) {
      response.cookies.set("google_provider_token", data.session.provider_token, {
        maxAge: 3300,
        secure: true,
        sameSite: "lax",
        path: "/",
      });
    }
  }

  return response;
}

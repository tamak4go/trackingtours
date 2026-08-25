import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// Google redirects here with a one-time `code` after the user approves
// sign-in. Exchanging it for a session sets the auth cookie that
// supabaseServer() and the browser client both read from.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const rawNext = req.nextUrl.searchParams.get("next") || "/";
  // Only ever a same-origin path -- a bare "//evil.com" or absolute URL
  // would otherwise turn this into an open redirect, since new URL()
  // happily resolves those against req.url.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  let ok = true;
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const url = new URL(next, req.url);
  if (!ok) url.searchParams.set("auth", "error");
  return NextResponse.redirect(url);
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// Google redirects here with a one-time `code` after the user approves
// sign-in. Exchanging it for a session sets the auth cookie that
// supabaseServer() and the browser client both read from.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") || "/";
  const response = NextResponse.redirect(new URL(next, req.url));

  if (code) {
    const supabase = await supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}

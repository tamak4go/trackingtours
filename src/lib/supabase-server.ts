import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side client that reads the session from cookies (set by the
// browser client via @supabase/ssr) -- used wherever a route handler or
// Server Component needs to know who's currently signed in. Distinct from
// supabase-admin.ts: this respects RLS and only ever acts as the current
// user, never bypasses anything.
export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.");
  }

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // In a Server Component (as opposed to a Route Handler or Proxy),
      // cookies() is read-only and this throws -- proxy.ts already
      // refreshes the session cookie on every request, so it's safe to
      // swallow here rather than crash page renders.
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // no-op, see above
        }
      },
    },
  });
}

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Browser-safe client using the anon key. Uses @supabase/ssr instead of the
// plain supabase-js client so an auth session (Google sign-in) is stored in
// cookies rather than localStorage -- that's what lets the server (route
// handlers, the trip page) read the same session via supabase-server.ts.
// RLS still denies anon table access (see supabase/schema.sql); this client
// is also used to call storage.uploadToSignedUrl(), authorized by the
// signed token itself, not by RLS.
let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.");
  }

  client = createBrowserClient(url, key);
  return client;
}

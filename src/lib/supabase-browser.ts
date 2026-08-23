import { createClient } from "@supabase/supabase-js";

// Browser-safe client using the anon key. Has zero table access (see
// supabase/schema.sql -- RLS denies anon by default); only used here to call
// storage.uploadToSignedUrl(), which is authorized by the signed token
// itself, not by RLS.
let client: ReturnType<typeof createClient> | null = null;

export function supabaseBrowser() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.");
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

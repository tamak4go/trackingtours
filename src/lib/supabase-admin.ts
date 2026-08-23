import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Server-only client using the service role key. Never import this from
// client components -- it bypasses row-level security entirely.
let client: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseAdmin() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. Copy .env.local.example to .env.local and fill them in.",
    );
  }

  client = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  return client;
}

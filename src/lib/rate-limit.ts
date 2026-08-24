import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Best-effort per-IP daily cap, backed by the `rate_limits` table (see
// supabase/schema.sql). Not atomic (read-then-write, so two concurrent
// requests from the same IP in the same instant could both slip through)
// and IPs are trivially spoofable/shared behind NAT or campus Wi-Fi -- this
// is meant to stop a naive script from filling up Storage for free, not to
// withstand a determined attacker.
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function checkRateLimit(
  req: NextRequest,
  action: string,
  limit: number,
): Promise<{ limited: boolean }> {
  const ip = clientIp(req);
  const day = new Date().toISOString().slice(0, 10); // yyyy-mm-dd, UTC
  const key = `${action}:${ip}:${day}`;

  const admin = supabaseAdmin();
  const { data } = await admin.from("rate_limits").select("count").eq("key", key).maybeSingle();

  if (data && data.count >= limit) {
    return { limited: true };
  }

  if (data) {
    await admin
      .from("rate_limits")
      .update({ count: data.count + 1, updated_at: new Date().toISOString() })
      .eq("key", key);
  } else {
    await admin.from("rate_limits").insert({ key, count: 1 });
  }

  return { limited: false };
}

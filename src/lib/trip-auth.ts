import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashToken } from "@/lib/token";

// Shared ownership check: there's no account system, so possession of the
// edit token minted at trip-creation time is the only proof of ownership.
// Anyone who only has the read-only share link can't rename, delete, or
// edit anything.
export async function requireOwnedTrip(slug: string, editToken: string | null) {
  if (!editToken) {
    return { error: NextResponse.json({ error: "Thiếu edit token" }, { status: 401 }) } as const;
  }
  const admin = supabaseAdmin();
  const { data: trip, error } = await admin.from("trips").select("id, edit_token_hash").eq("slug", slug).single();
  if (error || !trip) {
    return { error: NextResponse.json({ error: "Không tìm thấy chuyến đi" }, { status: 404 }) } as const;
  }
  if (trip.edit_token_hash !== hashToken(editToken)) {
    return { error: NextResponse.json({ error: "Edit token không hợp lệ" }, { status: 403 }) } as const;
  }
  return { admin, tripId: trip.id } as const;
}

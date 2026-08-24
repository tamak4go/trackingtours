import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { hashToken } from "@/lib/token";

// Shared ownership check: a trip is owned by whoever holds its edit token
// (minted at creation time, works for anonymous trips) OR, if it was
// created while signed in, by that same Google account. Either one proves
// ownership; anyone with only the read-only share link has neither.
export async function requireOwnedTrip(slug: string, editToken: string | null) {
  const admin = supabaseAdmin();
  const { data: trip, error } = await admin
    .from("trips")
    .select("id, edit_token_hash, user_id")
    .eq("slug", slug)
    .single();
  if (error || !trip) {
    return { error: NextResponse.json({ error: "Không tìm thấy chuyến đi" }, { status: 404 }) } as const;
  }

  if (editToken && trip.edit_token_hash === hashToken(editToken)) {
    return { admin, tripId: trip.id } as const;
  }

  if (trip.user_id) {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.id === trip.user_id) {
      return { admin, tripId: trip.id } as const;
    }
  }

  return {
    error: NextResponse.json({ error: editToken ? "Edit token không hợp lệ" : "Thiếu edit token" }, { status: editToken ? 403 : 401 }),
  } as const;
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

const LIMIT = 300;

// Flattened photos across all of the signed-in user's trips, for the
// Gallery page. Newest trip first, then sort_order within a trip.
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: trips, error: tripsErr } = await admin
    .from("trips")
    .select("id, slug, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (tripsErr) {
    console.error("list my trips for gallery failed", tripsErr);
    return NextResponse.json({ error: "Không tải được ảnh." }, { status: 500 });
  }

  const tripById = new Map((trips ?? []).map((t) => [t.id, t]));
  const tripIds = (trips ?? []).map((t) => t.id);
  if (!tripIds.length) return NextResponse.json({ photos: [] });

  const { data: photos, error: photosErr } = await admin
    .from("photos")
    .select("id, trip_id, storage_path, taken_at, sort_order")
    .in("trip_id", tripIds)
    .order("sort_order", { ascending: true })
    .limit(LIMIT);

  if (photosErr) {
    console.error("list gallery photos failed", photosErr);
    return NextResponse.json({ error: "Không tải được ảnh." }, { status: 500 });
  }

  // Newest trip's photos first: sort client-visible order by the parent
  // trip's created_at (already newest-first via tripById), stable sort
  // keeps each trip's own sort_order intact within that grouping.
  const tripOrder = new Map((trips ?? []).map((t, i) => [t.id, i]));
  const sorted = (photos ?? []).slice().sort((a, b) => (tripOrder.get(a.trip_id) ?? 0) - (tripOrder.get(b.trip_id) ?? 0));

  return NextResponse.json({
    photos: sorted.map((p) => ({
      id: p.id,
      url: admin.storage.from("trip-photos").getPublicUrl(p.storage_path).data.publicUrl,
      takenAt: p.taken_at,
      tripSlug: tripById.get(p.trip_id)?.slug ?? "",
      tripTitle: tripById.get(p.trip_id)?.title ?? null,
    })),
  });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

// Lists the signed-in user's trips from the database. Anonymous "my trips"
// (no account) still work the old way -- saved to and read from
// localStorage client-side, see src/lib/my-trips.ts -- this endpoint is only
// ever hit when there's a session to look up.
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: trips, error } = await admin
    .from("trips")
    .select("id, slug, title, distance_km, is_public, created_at, photos(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("list my trips failed", error);
    return NextResponse.json({ error: "Không tải được danh sách chuyến đi." }, { status: 500 });
  }

  // Card thumbnails: the first photo of each trip (sort_order 0, set when
  // photos are inserted at creation time -- see POST /api/trips). A second
  // round trip instead of embedding this in the query above, since
  // PostgREST doesn't have a clean "one row per group" embed and this
  // project has already spent enough time fighting its schema cache.
  const tripIds = (trips ?? []).map((t) => t.id);
  const { data: covers } = tripIds.length
    ? await admin.from("photos").select("trip_id, storage_path").in("trip_id", tripIds).eq("sort_order", 0)
    : { data: [] as { trip_id: string; storage_path: string }[] };
  const coverUrlByTripId = new Map(
    (covers ?? []).map((c) => [c.trip_id, admin.storage.from("trip-photos").getPublicUrl(c.storage_path).data.publicUrl]),
  );

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.json({
    trips: (trips ?? []).map((t) => ({
      slug: t.slug,
      title: t.title,
      distanceKm: Number(t.distance_km ?? 0),
      photoCount: t.photos[0]?.count ?? 0,
      isPublic: t.is_public,
      createdAt: t.created_at,
      shareUrl: `${site}/t/${t.slug}`,
      photoUrl: coverUrlByTripId.get(t.id) ?? null,
    })),
  });
}

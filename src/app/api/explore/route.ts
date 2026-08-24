import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PAGE_SIZE = 30;

// Lists public trips across every user, for the Explore/Community pages.
// No owner attribution is returned (no display-name/avatar join) -- trips
// are shown anonymized rather than adding a public profile surface this
// project doesn't otherwise have.
export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get("sort") === "distance" ? "distance" : "recent";
  const admin = supabaseAdmin();

  const query = admin
    .from("trips")
    .select("id, slug, title, distance_km, is_public, created_at, photos(count)")
    .eq("is_public", true)
    .limit(PAGE_SIZE);

  const { data: trips, error } =
    sort === "distance"
      ? await query.order("distance_km", { ascending: false })
      : await query.order("created_at", { ascending: false });

  if (error) {
    console.error("list explore trips failed", error);
    return NextResponse.json({ error: "Không tải được danh sách chuyến đi công khai." }, { status: 500 });
  }

  const tripIds = (trips ?? []).map((t) => t.id);
  const { data: covers } = tripIds.length
    ? await admin.from("photos").select("trip_id, storage_path").in("trip_id", tripIds).eq("sort_order", 0)
    : { data: [] as { trip_id: string; storage_path: string }[] };
  const coverUrlByTripId = new Map(
    (covers ?? []).map((c) => [c.trip_id, admin.storage.from("trip-photos").getPublicUrl(c.storage_path).data.publicUrl]),
  );

  const { count: totalPublicTrips } = await admin
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true);

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
    totalPublicTrips: totalPublicTrips ?? 0,
  });
}

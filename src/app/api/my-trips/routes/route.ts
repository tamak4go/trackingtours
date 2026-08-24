import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

// Route geometry for all of the signed-in user's trips, for the Map View
// page's combined overview map. Separate from GET /api/my-trips (which
// covers the card-grid pages) since route_geojson is the one field there
// that's actually large -- no point shipping it to pages that don't plot it.
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
    .select("slug, title, distance_km, route_mode, route_geojson, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("list my trip routes failed", error);
    return NextResponse.json({ error: "Không tải được lộ trình." }, { status: 500 });
  }

  return NextResponse.json({
    trips: (trips ?? [])
      .filter((t) => (t.route_geojson?.coordinates?.length ?? 0) >= 2)
      .map((t) => ({
        slug: t.slug,
        title: t.title,
        distanceKm: Number(t.distance_km ?? 0),
        routeMode: t.route_mode,
        routeCoords: t.route_geojson!.coordinates as [number, number][],
        createdAt: t.created_at,
      })),
  });
}

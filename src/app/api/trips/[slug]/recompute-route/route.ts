import { NextRequest, NextResponse } from "next/server";
import { requireOwnedTrip } from "@/lib/trip-auth";
import { fetchRoadRoute } from "@/lib/geo";

// Retries road-routing for a trip that fell back to a straight-line route at
// creation time (OSRM demo server timeout/hiccup, or >100 photos back when
// this ran client-side). Owner-triggered rather than automatic, since it's a
// deliberate "try again" action, not something to silently retry on every
// view. Recomputes from the trip's own stored photos, so it doesn't depend
// on the browser tab that originally uploaded them still being open.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editToken = req.nextUrl.searchParams.get("token");
  const result = await requireOwnedTrip(slug, editToken);
  if ("error" in result) return result.error;
  const { admin, tripId } = result;

  const { data: photos, error: fetchErr } = await admin
    .from("photos")
    .select("lat, lng")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });

  if (fetchErr || !photos || photos.length < 2) {
    return NextResponse.json({ error: "Không đủ ảnh có vị trí để tính lộ trình." }, { status: 400 });
  }
  if (photos.length > 100) {
    return NextResponse.json(
      { error: "Chuyến đi có hơn 100 ảnh -- OSRM demo server không nhận yêu cầu quá 100 điểm." },
      { status: 400 },
    );
  }

  const points = photos.map((p) => ({ lat: p.lat as number, lng: p.lng as number }));
  let route;
  try {
    route = await fetchRoadRoute(points);
  } catch (err) {
    console.warn("recompute route: OSRM still failing", err);
    return NextResponse.json({ error: "OSRM vẫn chưa tính được lộ trình. Thử lại sau." }, { status: 502 });
  }

  const { error: updateErr } = await admin
    .from("trips")
    .update({
      route_mode: "road",
      route_geojson: { type: "LineString", coordinates: route.coords },
      distance_km: route.distanceKm,
    })
    .eq("id", tripId);

  if (updateErr) {
    console.error("recompute route: save failed", updateErr);
    return NextResponse.json({ error: "Tính được lộ trình nhưng lưu thất bại." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    routeMode: "road" as const,
    routeCoords: route.coords,
    distanceKm: route.distanceKm,
  });
}

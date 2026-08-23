import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { TripView } from "@/components/TripView";
import type { Trip, TripPhoto, RouteMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TripPage(props: PageProps<"/t/[slug]">) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const editParam = searchParams?.edit;
  const editToken = typeof editParam === "string" ? editParam : null;

  const admin = supabaseAdmin();

  const { data: trip } = await admin
    .from("trips")
    .select("id, slug, title, distance_km, duration_ms, route_mode, route_geojson, created_at")
    .eq("slug", slug)
    .single();

  if (!trip) notFound();

  const { data: photoRows } = await admin
    .from("photos")
    .select("id, storage_path, lat, lng, taken_at, sort_order")
    .eq("trip_id", trip.id)
    .order("sort_order", { ascending: true });

  const photos: TripPhoto[] = (photoRows ?? []).map((p) => ({
    id: p.id,
    url: admin.storage.from("trip-photos").getPublicUrl(p.storage_path).data.publicUrl,
    lat: p.lat,
    lng: p.lng,
    takenAt: p.taken_at,
    sortOrder: p.sort_order,
  }));

  const tripData: Trip = {
    slug: trip.slug,
    title: trip.title,
    distanceKm: Number(trip.distance_km ?? 0),
    durationMs: Number(trip.duration_ms ?? 0),
    routeMode: trip.route_mode as RouteMode,
    routeCoords: (trip.route_geojson?.coordinates as [number, number][]) ?? [],
    photos,
    createdAt: trip.created_at,
  };

  return <TripView trip={tripData} editToken={editToken} />;
}

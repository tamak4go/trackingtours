import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { TripView } from "@/components/TripView";
import type { Trip, TripPhoto, RouteMode } from "@/lib/types";

export const dynamic = "force-dynamic";

// Wrapped in React's cache() so generateMetadata and the page component
// share one Supabase round trip per request instead of two. Returns the
// owning user_id alongside Trip (rather than folding it into Trip itself)
// so it never has to round-trip to the client -- see requireOwnedTrip for
// why it matters (ownership = edit_token match OR this user_id match).
const getTrip = cache(async (slug: string): Promise<{ trip: Trip; ownerUserId: string | null } | null> => {
  const admin = supabaseAdmin();

  const { data: trip } = await admin
    .from("trips")
    .select("id, slug, title, distance_km, duration_ms, route_mode, route_geojson, user_id, created_at")
    .eq("slug", slug)
    .single();

  if (!trip) return null;

  const { data: photoRows } = await admin
    .from("photos")
    .select("id, storage_path, lat, lng, taken_at, sort_order, place_name")
    .eq("trip_id", trip.id)
    .order("sort_order", { ascending: true });

  const photos: TripPhoto[] = (photoRows ?? []).map((p) => ({
    id: p.id,
    url: admin.storage.from("trip-photos").getPublicUrl(p.storage_path).data.publicUrl,
    lat: p.lat,
    lng: p.lng,
    takenAt: p.taken_at,
    sortOrder: p.sort_order,
    placeName: p.place_name,
  }));

  return {
    trip: {
      slug: trip.slug,
      title: trip.title,
      distanceKm: Number(trip.distance_km ?? 0),
      durationMs: Number(trip.duration_ms ?? 0),
      routeMode: trip.route_mode as RouteMode,
      routeCoords: (trip.route_geojson?.coordinates as [number, number][]) ?? [],
      photos,
      createdAt: trip.created_at,
    },
    ownerUserId: trip.user_id,
  };
});

export async function generateMetadata(props: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const found = await getTrip(slug);
  if (!found) return { title: "Không tìm thấy chuyến đi · Tracking Phượt" };
  const { trip } = found;

  const title = `${trip.title || "Chuyến đi phượt"} · Tracking Phượt`;
  const description = `${trip.distanceKm.toFixed(1)} km · ${trip.photos.length} ảnh — xem lộ trình trên bản đồ.`;
  const image = trip.photos[0]?.url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function TripPage(props: PageProps<"/t/[slug]">) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const editParam = searchParams?.edit;
  const editToken = typeof editParam === "string" ? editParam : null;

  const found = await getTrip(slug);
  if (!found) notFound();
  const { trip, ownerUserId } = found;

  let signedInAsOwner = false;
  if (ownerUserId) {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedInAsOwner = user?.id === ownerUserId;
  }

  return <TripView trip={trip} editToken={editToken} canEdit={!!editToken || signedInAsOwner} />;
}

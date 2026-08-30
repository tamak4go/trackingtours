import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { hashToken } from "@/lib/token";
import type { Trip, TripPhoto, RouteMode } from "@/lib/types";

// Shared by src/app/t/[slug]/page.tsx (map view) and
// src/app/t/[slug]/story/page.tsx (AI story reading page) so both routes
// fetch the same trip the same way instead of duplicating this query.
//
// Wrapped in React's cache() so a single request touching both this and
// generateMetadata (or, on the story route, this and its own metadata)
// shares one Supabase round trip. Returns the owning user_id and
// edit_token_hash alongside Trip (rather than folding them into Trip
// itself) so they never round-trip to the client -- see requireOwnedTrip
// for why it matters (ownership = edit_token match OR this user_id match),
// and isTripVisible below for why the hash is needed too (a private trip's
// own edit link must still resolve for its owner).
export const getTrip = cache(
  async (slug: string): Promise<{ trip: Trip; ownerUserId: string | null; editTokenHash: string } | null> => {
    const admin = supabaseAdmin();

    const { data: trip } = await admin
      .from("trips")
      .select(
        "id, slug, title, distance_km, duration_ms, route_mode, route_geojson, user_id, is_public, marker_icon_path, story, story_json, edit_token_hash, created_at",
      )
      .eq("slug", slug)
      .single();

    if (!trip) return null;

    // Custom upload takes priority; otherwise fall back to the owner's
    // current Google avatar (not persisted -- always fresh) if they're
    // signed in via one; otherwise null, and the marker renders the default
    // motorbike icon (see TripView.tsx's buildMotoMarkerEl).
    let markerIconUrl: string | null = null;
    const markerIconIsCustom = !!trip.marker_icon_path;
    if (trip.marker_icon_path) {
      markerIconUrl = admin.storage.from("trip-photos").getPublicUrl(trip.marker_icon_path).data.publicUrl;
    } else if (trip.user_id) {
      const { data: ownerData } = await admin.auth.admin.getUserById(trip.user_id);
      markerIconUrl = (ownerData.user?.user_metadata?.avatar_url as string | undefined) ?? null;
    }

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
        isPublic: trip.is_public,
        createdAt: trip.created_at,
        markerIconUrl,
        markerIconIsCustom,
        story: trip.story,
        storyJson: (trip.story_json as Trip["storyJson"]) ?? null,
      },
      ownerUserId: trip.user_id,
      editTokenHash: trip.edit_token_hash,
    };
  },
);

// A private trip is invisible to everyone except whoever can prove
// ownership -- the edit token (works for both anonymous and signed-in
// owners, since it's always minted at creation) or, for a signed-in owner
// without the token handy, a matching session. Deliberately 404s rather
// than a distinct "this trip is private" page, so a guessed/leaked slug for
// a private trip doesn't even confirm the trip exists.
export async function isTripVisible(
  found: { trip: Trip; ownerUserId: string | null; editTokenHash: string },
  editToken: string | null,
) {
  if (found.trip.isPublic) return true;
  if (editToken && hashToken(editToken) === found.editTokenHash) return true;
  if (found.ownerUserId) {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id === found.ownerUserId) return true;
  }
  return false;
}

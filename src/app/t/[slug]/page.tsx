import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { hashToken } from "@/lib/token";
import { TripView } from "@/components/TripView";
import type { Trip, TripPhoto, RouteMode } from "@/lib/types";

export const dynamic = "force-dynamic";

// Wrapped in React's cache() so generateMetadata and the page component
// share one Supabase round trip per request instead of two. Returns the
// owning user_id and edit_token_hash alongside Trip (rather than folding
// them into Trip itself) so they never round-trip to the client -- see
// requireOwnedTrip for why it matters (ownership = edit_token match OR this
// user_id match), and isTripVisible below for why the hash is needed too
// (a private trip's own edit link must still resolve for its owner).
const getTrip = cache(
  async (slug: string): Promise<{ trip: Trip; ownerUserId: string | null; editTokenHash: string } | null> => {
    const admin = supabaseAdmin();

    const { data: trip } = await admin
      .from("trips")
      .select("id, slug, title, distance_km, duration_ms, route_mode, route_geojson, user_id, is_public, edit_token_hash, created_at")
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
        isPublic: trip.is_public,
        createdAt: trip.created_at,
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
async function isTripVisible(found: { trip: Trip; ownerUserId: string | null; editTokenHash: string }, editToken: string | null) {
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

export async function generateMetadata(props: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const editParam = searchParams?.edit;
  const editToken = typeof editParam === "string" ? editParam : null;

  const found = await getTrip(slug);
  // Same 404-shaped fallback as the page itself for a private trip -- an
  // unauthorized preview (e.g. a chat unfurl bot) shouldn't see the title
  // or cover photo either.
  if (!found || !(await isTripVisible(found, editToken))) return { title: "Không tìm thấy chuyến đi · Tracking Phượt" };
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

  // Uses the verified check (real edit-token hash match, not just "a token
  // was present in the URL") -- unlike canEdit below, this one gates whether
  // the page's content is visible at all, so a guessed slug with a garbage
  // ?edit= value must not be enough to peek at a private trip.
  if (!(await isTripVisible(found, editToken))) notFound();

  return <TripView trip={trip} editToken={editToken} canEdit={!!editToken || signedInAsOwner} />;
}

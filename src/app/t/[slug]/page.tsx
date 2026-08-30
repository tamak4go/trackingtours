import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase-server";
import { TripView } from "@/components/TripView";
import { getTrip, isTripVisible } from "@/lib/get-trip";

export const dynamic = "force-dynamic";

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
  const stats = `${trip.distanceKm.toFixed(1)} km · ${trip.photos.length} ảnh — xem lộ trình trên bản đồ.`;
  const description = trip.story ? `${trip.story.slice(0, 180)}${trip.story.length > 180 ? "…" : ""}` : stats;
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
  // Set only by the render service's headless Chromium (see render-service/
  // and the renderMode effect in TripView.tsx) -- never by a real visitor.
  // Computed server-side (not read from window.location on the client) so
  // there's no mismatch between what the server renders and what the client
  // hydrates into: both agree on renderMode from the very first paint.
  const renderMode = searchParams?.render === "1";

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

  return <TripView trip={trip} editToken={editToken} canEdit={!!editToken || signedInAsOwner} renderMode={renderMode} />;
}

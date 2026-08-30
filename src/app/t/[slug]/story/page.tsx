import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase-server";
import { getTrip, isTripVisible } from "@/lib/get-trip";
import { StoryView } from "@/components/StoryView";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/t/[slug]/story">): Promise<Metadata> {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const editParam = searchParams?.edit;
  const editToken = typeof editParam === "string" ? editParam : null;

  const found = await getTrip(slug);
  if (!found || !(await isTripVisible(found, editToken))) return { title: "Không tìm thấy chuyến đi · Tracking Phượt" };
  const { trip } = found;

  const title = `${trip.storyJson?.tripTitle || trip.title || "Chuyến đi phượt"} · Nhật ký AI · Tracking Phượt`;
  const description = trip.story || `Câu chuyện AI của ${trip.title || "chuyến đi phượt"} này.`;
  const image = trip.storyJson?.timeline[0]?.photoUrl || trip.photos[0]?.url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
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

export default async function TripStoryPage(props: PageProps<"/t/[slug]/story">) {
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

  if (!(await isTripVisible(found, editToken))) notFound();

  return <StoryView trip={trip} editToken={editToken} canEdit={!!editToken || signedInAsOwner} />;
}

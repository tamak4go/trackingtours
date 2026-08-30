import { NextRequest, NextResponse } from "next/server";
import { requireOwnedTrip } from "@/lib/trip-auth";
import { geminiConfigured, generateTripStory } from "@/lib/gemini";
import { STORY_TONES, type StoryTone } from "@/lib/story-types";

// Whether the deployment has GEMINI_API_KEY set at all -- hides the
// "Tạo câu chuyện AI" button entirely instead of showing something that
// would 501, same pattern as GET /api/tiktok/status and GET /api/render-video.
export async function GET() {
  return NextResponse.json({ available: geminiConfigured() });
}

// Generates a short Vietnamese narrative from the trip's route stats + a
// sample of its photos (see src/lib/gemini.ts) and saves it on the trip row.
// Owner-triggered (not automatic on trip creation) so it doesn't add Gemini
// latency/cost to every upload, and so the owner can regenerate if they
// don't like the first result.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!geminiConfigured()) {
    return NextResponse.json({ error: "Tính năng chưa được bật trên server này." }, { status: 501 });
  }

  const { slug } = await params;
  const editToken = req.nextUrl.searchParams.get("token");
  const result = await requireOwnedTrip(slug, editToken);
  if ("error" in result) return result.error;
  const { admin, tripId } = result;

  let body: { tone?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const tone: StoryTone = typeof body.tone === "string" && body.tone in STORY_TONES ? (body.tone as StoryTone) : "enthusiastic";

  const { data: trip, error: tripErr } = await admin
    .from("trips")
    .select("title, distance_km, duration_ms")
    .eq("id", tripId)
    .single();
  if (tripErr || !trip) {
    return NextResponse.json({ error: "Không tìm thấy chuyến đi." }, { status: 404 });
  }

  const { data: photoRows, error: photosErr } = await admin
    .from("photos")
    .select("storage_path, place_name")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });
  if (photosErr || !photoRows || photoRows.length === 0) {
    return NextResponse.json({ error: "Chuyến đi chưa có ảnh." }, { status: 400 });
  }

  // Spread the sample evenly across the trip instead of just the first N,
  // so the timeline reflects the whole route rather than only its start.
  // Capped at 10 (matching the AI Studio companion app's 3-10 photo range)
  // rather than the full trip, which can have up to 300 photos.
  const sampleCount = Math.min(10, photoRows.length);
  const step = photoRows.length / sampleCount;
  const sample = Array.from({ length: sampleCount }, (_, i) => photoRows[Math.floor(i * step)]);
  const photos = sample.map((p) => ({
    url: admin.storage.from("trip-photos").getPublicUrl(p.storage_path).data.publicUrl,
    placeName: p.place_name,
  }));
  const placeNames = Array.from(new Set(photoRows.map((p) => p.place_name).filter((p): p is string => !!p)));

  let story;
  try {
    story = await generateTripStory({
      title: trip.title || "Chuyến đi phượt",
      distanceKm: Number(trip.distance_km ?? 0),
      durationMs: Number(trip.duration_ms ?? 0),
      placeNames,
      photos,
      tone,
    });
  } catch (err) {
    console.error("generate trip story failed", err);
    return NextResponse.json({ error: "Tạo câu chuyện thất bại, thử lại sau." }, { status: 502 });
  }

  // Gemini only returns photoIndex (0..N-1 into the sample sent above) --
  // attach the matching photo's real URL here so the story page can show an
  // actual photo per stop instead of text-only cards.
  story.timeline = story.timeline.map((stop) => ({ ...stop, photoUrl: photos[stop.photoIndex]?.url }));

  // `story` (flat text) stays around for the <meta description> on
  // t/[slug]/page.tsx; `story_json` holds the full structured timeline that
  // the dedicated /t/[slug]/story page renders.
  const flatStory = `${story.summary} ${story.conclusion}`.trim();
  const { error: updateErr } = await admin.from("trips").update({ story: flatStory, story_json: story }).eq("id", tripId);
  if (updateErr) {
    console.error("save trip story failed", updateErr);
    return NextResponse.json({ error: "Tạo được câu chuyện nhưng lưu thất bại." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, story });
}

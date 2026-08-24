import { NextRequest, NextResponse } from "next/server";
import { requireOwnedTrip } from "@/lib/trip-auth";

// Lets a trip's owner label a stop's location -- shown on the stop card
// during playback and in the lightbox. Left blank (null) until they set one;
// there's no auto-fill, since reverse-geocoding every photo in a trip would
// mean hundreds of sequential requests against Nominatim's 1-req/sec limit.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string; photoId: string }> }) {
  const { slug, photoId } = await params;
  const editToken = req.nextUrl.searchParams.get("token");
  const result = await requireOwnedTrip(slug, editToken);
  if ("error" in result) return result.error;
  const { admin, tripId } = result;

  let body: { placeName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu gửi lên." }, { status: 400 });
  }

  if (typeof body.placeName !== "string") {
    return NextResponse.json({ error: "Thiếu tên địa điểm." }, { status: 400 });
  }
  const placeName = body.placeName.trim().slice(0, 200) || null;

  const { error, data } = await admin
    .from("photos")
    .update({ place_name: placeName })
    .eq("id", photoId)
    .eq("trip_id", tripId) // scopes the update to this trip so one edit token can't touch another trip's photos
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Không tìm thấy ảnh trong chuyến đi này." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, placeName });
}

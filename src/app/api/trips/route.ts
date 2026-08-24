import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";
import { genSlug, genEditToken, hashToken } from "@/lib/token";
import { reverseGeocodePlaceName } from "@/lib/geocode";
import type { RouteMode } from "@/lib/types";

type IncomingPhoto = {
  fileName: string;
  lat: number;
  lng: number;
  takenAt: string | null;
  contentType: string;
};

type CreateTripBody = {
  title?: string;
  distanceKm: number;
  durationMs: number;
  routeMode: RouteMode;
  routeCoords: [number, number][];
  photos: IncomingPhoto[];
};

const BUCKET = "trip-photos";

function extFor(contentType: string): string {
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/png") return "png";
  return "jpg";
}

function isFiniteLatLng(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
}

export async function POST(req: NextRequest) {
  let body: CreateTripBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu gửi lên." }, { status: 400 });
  }

  if (!Array.isArray(body.photos) || body.photos.length === 0) {
    return NextResponse.json({ error: "Cần ít nhất 1 ảnh để tạo chuyến đi." }, { status: 400 });
  }
  if (body.photos.length > 300) {
    return NextResponse.json({ error: "Một chuyến đi tối đa 300 ảnh." }, { status: 400 });
  }
  if (
    !Array.isArray(body.routeCoords) ||
    body.routeCoords.length < 2 ||
    !body.routeCoords.every((c) => Array.isArray(c) && isFiniteLatLng(c[1], c[0])) ||
    !Number.isFinite(body.distanceKm)
  ) {
    // Most commonly caused by a photo whose EXIF GPS parsed to NaN (some
    // cameras write GPS tags as 0/0 degree-minute-second fractions when
    // there was no fix) leaking through client-side validation -- see
    // src/lib/process-photos.ts for where that's filtered out.
    return NextResponse.json({ error: "Dữ liệu vị trí không hợp lệ. Thử lại hoặc bỏ bớt ảnh có GPS đáng ngờ." }, { status: 400 });
  }
  if (!body.photos.every((p) => isFiniteLatLng(p.lat, p.lng))) {
    return NextResponse.json({ error: "Có ảnh chứa toạ độ GPS không hợp lệ." }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const slug = genSlug();
  const editToken = genEditToken();

  // If they're signed in, the trip is also owned by their account (see
  // src/lib/trip-auth.ts) -- on top of, not instead of, the edit token,
  // so a share link with ?edit=... still works the same either way.
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let title = body.title?.slice(0, 200) || null;
  if (!title && body.routeCoords.length) {
    const [midLng, midLat] = body.routeCoords[Math.floor(body.routeCoords.length / 2)];
    const placeName = await reverseGeocodePlaceName(midLat, midLng);
    if (placeName) title = `Chuyến đi ${placeName}`;
  }

  const { data: trip, error: tripErr } = await admin
    .from("trips")
    .insert({
      slug,
      edit_token_hash: hashToken(editToken),
      title,
      distance_km: body.distanceKm,
      duration_ms: Math.round(body.durationMs),
      route_mode: body.routeMode,
      route_geojson: { type: "LineString", coordinates: body.routeCoords },
      user_id: user?.id ?? null,
    })
    .select("id, slug")
    .single();

  if (tripErr || !trip) {
    console.error("create trip failed", tripErr);
    return NextResponse.json({ error: "Tạo chuyến đi thất bại (lỗi máy chủ)." }, { status: 500 });
  }

  const uploads: { photoId: string; path: string; token: string; signedUrl: string }[] = [];
  const photoRows: {
    id: string;
    trip_id: string;
    storage_path: string;
    lat: number;
    lng: number;
    taken_at: string | null;
    sort_order: number;
  }[] = [];

  for (let i = 0; i < body.photos.length; i++) {
    const p = body.photos[i];
    const photoId = crypto.randomUUID();
    const path = `${trip.id}/${photoId}.${extFor(p.contentType)}`;

    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (signErr || !signed) {
      console.error("signed url failed", signErr);
      await admin.from("trips").delete().eq("id", trip.id); // cleanup partial trip
      return NextResponse.json({ error: "Chuẩn bị tải ảnh lên thất bại." }, { status: 500 });
    }

    uploads.push({ photoId, path, token: signed.token, signedUrl: signed.signedUrl });
    photoRows.push({
      id: photoId,
      trip_id: trip.id,
      storage_path: path,
      lat: p.lat,
      lng: p.lng,
      taken_at: p.takenAt,
      sort_order: i,
    });
  }

  const { error: photosErr } = await admin.from("photos").insert(photoRows);
  if (photosErr) {
    console.error("insert photos failed", photosErr);
    await admin.from("trips").delete().eq("id", trip.id);
    return NextResponse.json({ error: "Lưu thông tin ảnh thất bại." }, { status: 500 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.json({
    slug: trip.slug,
    editToken,
    shareUrl: `${site}/t/${trip.slug}`,
    editUrl: `${site}/t/${trip.slug}?edit=${editToken}`,
    uploads,
  });
}

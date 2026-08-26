import { NextRequest, NextResponse } from "next/server";
import { requireOwnedTrip } from "@/lib/trip-auth";

const BUCKET = "trip-photos";
const MAX_BYTES = 2 * 1024 * 1024;

function decodeDataUrl(dataUrl: string): { contentType: string; ext: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const ext = contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
  return { contentType, ext, buffer: Buffer.from(match[2], "base64") };
}

// Sets (or replaces) the moving marker's custom image for a trip, shown
// during Play instead of the default motorbike icon / owner's Google
// avatar fallback (see buildMotoMarkerEl in TripView.tsx and the fallback
// resolution in t/[slug]/page.tsx). Deterministic path per trip
// (upsert: true) so re-uploading overwrites the old one instead of leaking
// orphaned objects in the bucket.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editToken = req.nextUrl.searchParams.get("token");
  const result = await requireOwnedTrip(slug, editToken);
  if ("error" in result) return result.error;
  const { admin, tripId } = result;

  let body: { dataUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu gửi lên." }, { status: 400 });
  }

  if (typeof body.dataUrl !== "string") {
    return NextResponse.json({ error: "Thiếu ảnh." }, { status: 400 });
  }
  const decoded = decodeDataUrl(body.dataUrl);
  if (!decoded) {
    return NextResponse.json({ error: "Định dạng ảnh không hợp lệ." }, { status: 400 });
  }
  if (decoded.buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh quá lớn." }, { status: 400 });
  }

  const path = `${tripId}/marker.${decoded.ext}`;
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: true });
  if (uploadErr) {
    console.error("marker icon upload failed", uploadErr);
    return NextResponse.json({ error: "Tải ảnh lên thất bại." }, { status: 500 });
  }

  const { error: updateErr } = await admin.from("trips").update({ marker_icon_path: path }).eq("id", tripId);
  if (updateErr) {
    console.error("update marker_icon_path failed", updateErr);
    return NextResponse.json({ error: "Lưu ảnh thất bại." }, { status: 500 });
  }

  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ ok: true, url });
}

// Clears the custom marker image -- Play then falls back to the owner's
// Google avatar (or the default icon if there is none).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editToken = req.nextUrl.searchParams.get("token");
  const result = await requireOwnedTrip(slug, editToken);
  if ("error" in result) return result.error;
  const { admin, tripId } = result;

  const { data: current } = await admin.from("trips").select("marker_icon_path").eq("id", tripId).single();
  if (current?.marker_icon_path) {
    await admin.storage.from(BUCKET).remove([current.marker_icon_path]);
  }

  const { error: updateErr } = await admin.from("trips").update({ marker_icon_path: null }).eq("id", tripId);
  if (updateErr) {
    console.error("clear marker_icon_path failed", updateErr);
    return NextResponse.json({ error: "Xoá ảnh thất bại." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

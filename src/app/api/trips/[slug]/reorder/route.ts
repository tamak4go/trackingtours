import { NextRequest, NextResponse } from "next/server";
import { requireOwnedTrip } from "@/lib/trip-auth";

// Lets the owner manually fix photo order (e.g. a camera with a wrong clock
// puts a photo out of sequence) by supplying the full, reordered list of
// photo ids. Rewrites sort_order to match the given order; scoped to this
// trip's own photo ids so one edit token can't touch another trip's photos.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editToken = req.nextUrl.searchParams.get("token");
  const result = await requireOwnedTrip(slug, editToken);
  if ("error" in result) return result.error;
  const { admin, tripId } = result;

  let body: { photoIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu gửi lên." }, { status: 400 });
  }

  const photoIds = body.photoIds;
  if (!Array.isArray(photoIds) || !photoIds.every((id) => typeof id === "string") || photoIds.length === 0) {
    return NextResponse.json({ error: "Danh sách thứ tự ảnh không hợp lệ." }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await admin.from("photos").select("id").eq("trip_id", tripId);
  if (fetchErr) {
    return NextResponse.json({ error: "Không đọc được danh sách ảnh." }, { status: 500 });
  }
  const existingIds = new Set((existing ?? []).map((p) => p.id));
  if (photoIds.length !== existingIds.size || !photoIds.every((id) => existingIds.has(id))) {
    return NextResponse.json({ error: "Danh sách thứ tự ảnh không khớp với chuyến đi này." }, { status: 400 });
  }

  // No bulk-update-with-different-values in PostgREST, so one request per
  // photo -- fine at the sub-300-photo scale this app caps trips at.
  const results = await Promise.all(
    photoIds.map((id, i) => admin.from("photos").update({ sort_order: i }).eq("id", id).eq("trip_id", tripId)),
  );
  const failed = results.find((r) => r.error);
  if (failed) {
    console.error("reorder photos failed", failed.error);
    return NextResponse.json({ error: "Sắp xếp lại ảnh thất bại." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

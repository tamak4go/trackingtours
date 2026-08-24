import { NextRequest, NextResponse } from "next/server";
import { requireOwnedTrip } from "@/lib/trip-auth";

// Deletes a trip and its photos (DB row via cascade, storage objects swept
// explicitly since Storage isn't covered by Postgres foreign keys).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editToken = req.nextUrl.searchParams.get("token");
  const result = await requireOwnedTrip(slug, editToken);
  if ("error" in result) return result.error;
  const { admin, tripId } = result;

  const { data: photos } = await admin.from("photos").select("storage_path").eq("trip_id", tripId);
  if (photos && photos.length) {
    await admin.storage.from("trip-photos").remove(photos.map((p) => p.storage_path));
  }
  await admin.from("trips").delete().eq("id", tripId);

  return NextResponse.json({ ok: true });
}

// Renames a trip -- the auto-generated title (reverse-geocoded from the
// route midpoint, see src/lib/geocode.ts) is only a best-effort guess and
// is sometimes not the name the owner would pick themselves.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editToken = req.nextUrl.searchParams.get("token");
  const result = await requireOwnedTrip(slug, editToken);
  if ("error" in result) return result.error;
  const { admin, tripId } = result;

  let body: { title?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Không đọc được dữ liệu gửi lên." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) {
    return NextResponse.json({ error: "Tên chuyến đi không được để trống." }, { status: 400 });
  }

  const { error: updateErr } = await admin.from("trips").update({ title }).eq("id", tripId);
  if (updateErr) {
    console.error("rename trip failed", updateErr);
    return NextResponse.json({ error: "Đổi tên thất bại." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, title });
}

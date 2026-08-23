import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashToken } from "@/lib/token";

// Shared ownership check for both handlers below: there's no account
// system, so possession of the edit token minted at creation time is the
// only proof of ownership. Anyone who only has the read-only share link
// can't rename or delete.
async function requireOwnedTrip(slug: string, editToken: string | null) {
  if (!editToken) {
    return { error: NextResponse.json({ error: "Thiếu edit token" }, { status: 401 }) } as const;
  }
  const admin = supabaseAdmin();
  const { data: trip, error } = await admin.from("trips").select("id, edit_token_hash").eq("slug", slug).single();
  if (error || !trip) {
    return { error: NextResponse.json({ error: "Không tìm thấy chuyến đi" }, { status: 404 }) } as const;
  }
  if (trip.edit_token_hash !== hashToken(editToken)) {
    return { error: NextResponse.json({ error: "Edit token không hợp lệ" }, { status: 403 }) } as const;
  }
  return { admin, tripId: trip.id } as const;
}

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

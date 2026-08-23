import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashToken } from "@/lib/token";

// Deletes a trip (and its photos, via ON DELETE CASCADE + a storage sweep).
// Authorized by the edit token minted when the trip was created -- there is
// no account system, so possession of that token is the only proof of
// ownership. Anyone who only has the read-only share link cannot delete.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const editToken = req.nextUrl.searchParams.get("token");
  if (!editToken) {
    return NextResponse.json({ error: "Missing edit token" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: trip, error } = await admin
    .from("trips")
    .select("id, edit_token_hash")
    .eq("slug", slug)
    .single();

  if (error || !trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (trip.edit_token_hash !== hashToken(editToken)) {
    return NextResponse.json({ error: "Invalid edit token" }, { status: 403 });
  }

  const { data: photos } = await admin.from("photos").select("storage_path").eq("trip_id", trip.id);
  if (photos && photos.length) {
    await admin.storage.from("trip-photos").remove(photos.map((p) => p.storage_path));
  }
  await admin.from("trips").delete().eq("id", trip.id);

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

// Lists the signed-in user's trips from the database. Anonymous "my trips"
// (no account) still work the old way -- saved to and read from
// localStorage client-side, see src/lib/my-trips.ts -- this endpoint is only
// ever hit when there's a session to look up.
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: trips, error } = await admin
    .from("trips")
    .select("slug, title, distance_km, created_at, photos(count)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("list my trips failed", error);
    return NextResponse.json({ error: "Không tải được danh sách chuyến đi." }, { status: 500 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.json({
    trips: (trips ?? []).map((t) => ({
      slug: t.slug,
      title: t.title,
      distanceKm: Number(t.distance_km ?? 0),
      photoCount: t.photos[0]?.count ?? 0,
      createdAt: t.created_at,
      shareUrl: `${site}/t/${t.slug}`,
    })),
  });
}

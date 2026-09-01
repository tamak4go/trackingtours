import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

// Fired alongside the client's existing recordLike(slug) (see
// src/lib/firebase.ts) whenever someone thumbs-up a trip's share page --
// that call bumps the public like counter, this one is the side effect of
// notifying the owner about it, entirely independent of whether Firebase is
// even configured. Deliberately open to anonymous callers (most likers
// aren't signed in), and a no-op whenever there's nobody to notify: trips
// made without an account (owner_user_id null) have no account to check
// notifications on, and an owner liking their own trip from another
// session/device shouldn't notify themselves.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = supabaseAdmin();

  const { data: trip } = await admin.from("trips").select("user_id, title").eq("slug", slug).single();
  if (!trip || !trip.user_id) return new NextResponse(null, { status: 204 });

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === trip.user_id) return new NextResponse(null, { status: 204 });

  const { error } = await admin.from("notifications").insert({
    owner_user_id: trip.user_id,
    trip_slug: slug,
    trip_title: trip.title,
    type: "like",
  });
  if (error) {
    console.error("insert like notification failed", error);
    return NextResponse.json({ error: "Không ghi được thông báo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

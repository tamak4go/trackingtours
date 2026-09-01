import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

const PAGE_SIZE = 20;

// Backs the bell icon in DashboardShell -- signed-in owners only (see
// schema.sql's notifications table comment for why anonymous/edit-token
// trips have no account to check this on). Uses the caller's own session
// (not a slug/token like the trip routes) to decide whose notifications to
// return, so there's nothing here for a signed-out request to even ask for.
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  const admin = supabaseAdmin();
  const [{ data: notifications, error }, { count: unreadCount }] = await Promise.all([
    admin
      .from("notifications")
      .select("id, trip_slug, trip_title, type, read, created_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id)
      .eq("read", false),
  ]);

  if (error) {
    console.error("list notifications failed", error);
    return NextResponse.json({ error: "Không tải được thông báo." }, { status: 500 });
  }

  return NextResponse.json({
    notifications: (notifications ?? []).map((n) => ({
      id: n.id,
      tripSlug: n.trip_slug,
      tripTitle: n.trip_title,
      type: n.type,
      read: n.read,
      createdAt: n.created_at,
    })),
    unreadCount: unreadCount ?? 0,
  });
}

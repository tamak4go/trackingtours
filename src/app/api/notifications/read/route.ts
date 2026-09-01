import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

// Marks every one of the caller's own unread notifications as read -- fired
// when the bell dropdown opens (see NotificationBell.tsx), not per-item,
// since the list is short enough that "opened it" is a good enough signal
// without per-row read receipts.
export async function POST() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });

  const admin = supabaseAdmin();
  const { error } = await admin.from("notifications").update({ read: true }).eq("owner_user_id", user.id).eq("read", false);
  if (error) {
    console.error("mark notifications read failed", error);
    return NextResponse.json({ error: "Không cập nhật được." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { TIKTOK_COOKIE } from "@/lib/tiktok";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const name of Object.values(TIKTOK_COOKIE)) res.cookies.delete(name);
  return res;
}

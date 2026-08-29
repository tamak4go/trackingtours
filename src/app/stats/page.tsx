"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gauge, Route, Clock, Camera, TrendingUp } from "lucide-react";
import { useAuthUser } from "@/lib/use-auth-user";
import { DashboardShell } from "@/components/DashboardShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { StatusPanel } from "@/components/StatusPanel";

type AccountTrip = {
  slug: string;
  title: string | null;
  distanceKm: number;
  durationMs: number;
  photoCount: number;
  createdAt: string;
};

function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m ? m + "p" : ""}`;
}

export default function StatsPage() {
  const { user, loaded } = useAuthUser();
  const [trips, setTrips] = useState<AccountTrip[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/my-trips")
      .then((res) => (res.ok ? res.json() : { trips: [] }))
      .then((data) => {
        if (!cancelled) setTrips(data.trips ?? []);
      })
      .catch(() => {
        if (!cancelled) setTrips([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const totalKm = trips?.reduce((s, t) => s + t.distanceKm, 0) ?? 0;
  const totalMs = trips?.reduce((s, t) => s + t.durationMs, 0) ?? 0;
  const totalPhotos = trips?.reduce((s, t) => s + t.photoCount, 0) ?? 0;
  const avgSpeed = totalMs > 0 ? totalKm / (totalMs / 3_600_000) : 0;
  const longest = trips && trips.length ? trips.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a)) : null;

  return (
    <DashboardShell active="stats">
      <div className="w-full max-w-5xl mt-10 sm:mt-14">
        <div className="flex items-center gap-2.5 mb-2">
          <Gauge size={22} className="text-accent-2" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95">Stats</h1>
        </div>
        <p className="text-muted text-sm mb-8">Tổng hợp toàn bộ chuyến đi trong tài khoản của bạn.</p>

        {!loaded ? (
          <StatusPanel>Đang tải...</StatusPanel>
        ) : !user ? (
          <SignInPrompt reason="Stats tổng hợp số liệu từ mọi chuyến đi trong tài khoản của bạn." />
        ) : trips === null ? (
          <StatusPanel>Đang tải...</StatusPanel>
        ) : trips.length === 0 ? (
          <StatusPanel icon={Route}>Chưa có chuyến đi nào để thống kê. Bắt đầu chuyến đi đầu tiên nhé!</StatusPanel>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatTile icon={Route} label="Tổng quãng đường" value={`${totalKm.toFixed(0)} km`} />
              <StatTile icon={Clock} label="Tổng thời gian" value={fmtDuration(totalMs)} />
              <StatTile icon={Camera} label="Tổng số ảnh" value={totalPhotos.toString()} />
              <StatTile icon={TrendingUp} label="Tốc độ TB" value={avgSpeed > 0 ? `${avgSpeed.toFixed(1)} km/h` : "—"} />
            </div>

            {longest && (
              <Link
                href={`/t/${longest.slug}`}
                className="glass rounded-2xl p-5 mb-8 flex items-center justify-between hover:border-accent/40 border border-transparent transition-colors"
              >
                <div>
                  <h2 className="text-xs text-muted mb-1">Chuyến đi dài nhất</h2>
                  <div className="text-base font-bold text-white/90">
                    {longest.title || `${longest.distanceKm.toFixed(1)} km · ${longest.photoCount} ảnh`}
                  </div>
                </div>
                <div className="text-accent font-bold text-lg">{longest.distanceKm.toFixed(1)} km</div>
              </Link>
            )}

            <div className="text-xs text-muted mb-3">Số chuyến đi: {trips.length}</div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2">
      <Icon size={16} className="text-accent" />
      <span className="text-xl font-bold text-white/90">{value}</span>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Route, Camera } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { TripCard, type TripCardData } from "@/components/TripCard";

type ExploreTrip = TripCardData & { shareUrl: string };

export default function CommunityPage() {
  const [trips, setTrips] = useState<ExploreTrip[] | null>(null);
  const [totalPublicTrips, setTotalPublicTrips] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/explore?sort=recent")
      .then((res) => (res.ok ? res.json() : { trips: [], totalPublicTrips: 0 }))
      .then((data) => {
        if (cancelled) return;
        setTrips(data.trips ?? []);
        setTotalPublicTrips(data.totalPublicTrips ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setTrips([]);
          setTotalPublicTrips(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recentKm = (trips ?? []).reduce((sum, t) => sum + t.distanceKm, 0);
  const recentPhotos = (trips ?? []).reduce((sum, t) => sum + t.photoCount, 0);

  return (
    <DashboardShell active="community">
      <div className="w-full max-w-5xl mt-10 sm:mt-14">
        <div className="flex items-center gap-2.5 mb-2">
          <Users size={22} className="text-accent-2" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95">Community</h1>
        </div>
        <p className="text-white/40 text-sm mb-8">Những chuyến đi mới nhất được chia sẻ công khai bởi cộng đồng.</p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatTile icon={Route} label="Chuyến đi công khai" value={totalPublicTrips === null ? "—" : totalPublicTrips.toString()} />
          <StatTile icon={Route} label="Km gần đây" value={trips === null ? "—" : `${recentKm.toFixed(0)}`} />
          <StatTile icon={Camera} label="Ảnh gần đây" value={trips === null ? "—" : recentPhotos.toString()} />
        </div>

        {trips === null ? (
          <div className="text-center text-white/30 text-sm py-16 glass rounded-2xl">Đang tải...</div>
        ) : trips.length === 0 ? (
          <div className="text-center text-white/30 text-sm py-16 glass rounded-2xl">
            Cộng đồng chưa có chuyến đi công khai nào. Hãy là người đầu tiên!
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-10"
          >
            {trips.map((t) => (
              <TripCard key={t.slug} trip={t} href={t.shareUrl} />
            ))}
          </motion.div>
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
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}

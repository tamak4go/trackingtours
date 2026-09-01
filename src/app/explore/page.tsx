"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass, Route } from "lucide-react";
import { staggerGrid, staggerItem } from "@/lib/motion";
import { DashboardShell } from "@/components/DashboardShell";
import { StatusPanel } from "@/components/StatusPanel";
import { TripCard, type TripCardData } from "@/components/TripCard";

type ExploreTrip = TripCardData & { shareUrl: string };
type SortKey = "recent" | "distance";

export default function ExplorePage() {
  const [sort, setSort] = useState<SortKey>("recent");
  const [trips, setTrips] = useState<ExploreTrip[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/explore?sort=${sort}`)
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
  }, [sort]);

  return (
    <DashboardShell active="explore">
      <div className="w-full max-w-5xl mt-10 sm:mt-14">
        <div className="flex items-center gap-2.5 mb-2">
          <Compass size={22} className="text-accent-2" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95">Explore</h1>
        </div>
        <p className="text-muted text-sm mb-8">Chuyến đi công khai từ mọi rider trên Tracking Phượt.</p>

        <div className="flex gap-2 mb-6">
          {(
            [
              { key: "recent", label: "Mới nhất" },
              { key: "distance", label: "Dài nhất" },
            ] as { key: SortKey; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={
                sort === opt.key
                  ? "px-4 py-2.5 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/40 active:scale-95 transition-transform duration-150 ease-snappy focus-ring"
                  : "px-4 py-2.5 rounded-full text-xs font-semibold bg-white/[0.04] text-white/50 border border-white/10 hover:text-white/80 active:scale-95 transition-all duration-150 ease-snappy focus-ring"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {trips === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl overflow-hidden flex flex-col animate-pulse">
                <div className="h-32 bg-white/[0.06]" />
                <div className="p-3.5 flex flex-col gap-2">
                  <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <div className="h-3 w-16 rounded bg-white/[0.06]" />
                    <div className="h-3 w-12 rounded bg-white/[0.06]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : trips.length === 0 ? (
          <StatusPanel icon={Route}>Chưa có chuyến đi công khai nào. Hãy là người đầu tiên chia sẻ!</StatusPanel>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerGrid}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-10"
          >
            {trips.map((t) => (
              <motion.div key={t.slug} variants={staggerItem}>
                <TripCard trip={t} href={t.shareUrl} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </DashboardShell>
  );
}

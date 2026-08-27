"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { staggerGrid, staggerItem } from "@/lib/motion";
import { DashboardShell } from "@/components/DashboardShell";
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
                  ? "px-4 py-2.5 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/40 active:scale-95 transition-transform duration-150 ease-snappy"
                  : "px-4 py-2.5 rounded-full text-xs font-semibold bg-white/[0.04] text-white/50 border border-white/10 hover:text-white/80 active:scale-95 transition-all duration-150 ease-snappy"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {trips === null ? (
          <div className="text-center text-muted text-sm py-16 glass rounded-2xl">Đang tải...</div>
        ) : trips.length === 0 ? (
          <div className="text-center text-muted text-sm py-16 glass rounded-2xl">
            Chưa có chuyến đi công khai nào. Hãy là người đầu tiên chia sẻ!
          </div>
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

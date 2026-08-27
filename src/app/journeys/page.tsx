"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Plus } from "lucide-react";
import { useMyTrips, removeMyTrip } from "@/lib/my-trips";
import { useAuthUser } from "@/lib/use-auth-user";
import { staggerGrid, staggerItem } from "@/lib/motion";
import { DashboardShell } from "@/components/DashboardShell";
import { JourneyCard } from "@/components/JourneyCard";
import type { TripCardData } from "@/components/TripCard";

type AccountTrip = TripCardData & { shareUrl: string };
type SortKey = "newest" | "oldest" | "distance";

export default function JourneysPage() {
  const localTrips = useMyTrips();
  const { user, loaded } = useAuthUser();
  const [accountTrips, setAccountTrips] = useState<AccountTrip[] | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/my-trips")
      .then((res) => (res.ok ? res.json() : { trips: [] }))
      .then((data) => {
        if (!cancelled) setAccountTrips(data.trips ?? []);
      })
      .catch(() => {
        if (!cancelled) setAccountTrips([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  type ListedTrip = TripCardData & { href: string; removable: boolean };
  const rawTrips: ListedTrip[] | null = user
    ? accountTrips === null
      ? null
      : accountTrips.map((t) => ({ ...t, href: t.shareUrl, removable: false }))
    : localTrips.map((t) => ({ ...t, title: null, href: t.editUrl, removable: true }));

  const trips = useMemo(() => {
    if (!rawTrips) return null;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rawTrips.filter((t) => (t.title || "").toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
      : rawTrips.slice();
    filtered.sort((a, b) => {
      if (sort === "distance") return b.distanceKm - a.distanceKm;
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sort === "oldest" ? da - db : db - da;
    });
    return filtered;
  }, [rawTrips, query, sort]);

  return (
    <DashboardShell active="journeys">
      <div className="w-full max-w-5xl mt-10 sm:mt-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95">My Journeys</h1>
            <p className="text-white/40 text-sm mt-1">
              {user ? "Toàn bộ chuyến đi đã lưu vào tài khoản của bạn." : "Chuyến đi lưu trên trình duyệt này."}
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 self-start sm:self-auto bg-gradient-to-r from-accent to-gradient-pink text-neutral-950 text-sm font-bold px-5 py-2.5 rounded-full shadow-[0_10px_30px_rgba(255,122,69,0.3)] hover:brightness-105 active:scale-[0.97] transition-all duration-150 ease-snappy"
          >
            <Plus size={16} />
            Chuyến đi mới
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên chuyến đi..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white/[0.04] border border-white/10 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {(
              [
                { key: "newest", label: "Mới nhất" },
                { key: "oldest", label: "Cũ nhất" },
                { key: "distance", label: "Xa nhất" },
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
        </div>

        {!loaded || trips === null ? (
          <div className="text-center text-white/30 text-sm py-16 glass rounded-2xl">Đang tải...</div>
        ) : trips.length === 0 ? (
          <div className="text-center text-white/30 text-sm py-16 glass rounded-2xl">
            {query ? "Không tìm thấy chuyến đi nào khớp." : 'Chưa có chuyến đi nào. Bấm "Chuyến đi mới" để bắt đầu.'}
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerGrid}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-10"
          >
            {trips.map((t) => (
              <motion.div key={t.slug} variants={staggerItem}>
                <JourneyCard trip={t} href={t.href} onRemove={t.removable ? () => removeMyTrip(t.slug) : undefined} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </DashboardShell>
  );
}

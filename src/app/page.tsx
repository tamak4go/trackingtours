"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Route, Trash2, Plus } from "lucide-react";
import { useMyTrips, removeMyTrip } from "@/lib/my-trips";
import { useAuthUser } from "@/lib/use-auth-user";
import { TopNav } from "@/components/TopNav";

type AccountTrip = {
  slug: string;
  title: string | null;
  distanceKm: number;
  photoCount: number;
  createdAt: string;
  shareUrl: string;
  photoUrl: string | null;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Home() {
  const localTrips = useMyTrips();
  const { user } = useAuthUser();
  // Signed-in users see their trips synced from the database (by account,
  // works across devices/browsers) instead of the localStorage list -- see
  // GET /api/my-trips. Signed-out users keep the old localStorage-only list.
  const [accountTrips, setAccountTrips] = useState<AccountTrip[] | null>(null);
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

  const hasAccountTrips = !!(accountTrips && accountTrips.length > 0);
  const totalKm = hasAccountTrips ? accountTrips!.reduce((sum, t) => sum + t.distanceKm, 0) : 0;
  const showTrips = user ? hasAccountTrips : localTrips.length > 0;

  return (
    <>
      <div className="bg-mesh" />
      <TopNav />

      <main className="flex-1 flex flex-col items-center p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-9 mt-4 max-w-md"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-[#ff5f8f] shadow-lg shadow-accent/30 text-2xl mb-4">
            🏍️
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Tracking <span className="text-gradient">Phượt</span>
          </h1>
          <p className="text-white/50 text-sm mt-2.5 leading-relaxed max-w-sm mx-auto">
            Upload ảnh chuyến đi → tự tính lộ trình từ GPS trong ảnh → có link chia sẻ cho bạn bè xem lại.
          </p>
          {hasAccountTrips && (
            <div className="inline-flex items-center gap-1.5 mt-4 text-xs text-white/60 bg-white/[0.05] border border-white/10 px-3 py-1.5 rounded-full">
              <Route size={13} className="text-accent" />
              <span>
                <b className="text-white/85">{accountTrips!.length}</b> chuyến đi ·{" "}
                <b className="text-white/85">{totalKm.toFixed(0)}</b> km
              </span>
            </div>
          )}
          <a
            href="/upload"
            className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold bg-gradient-to-r from-accent to-[#ff5f8f] text-neutral-950 shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:brightness-105 active:scale-[0.99] transition-all"
          >
            <Plus size={18} strokeWidth={2.6} />
            Tạo chuyến đi mới
          </a>
        </motion.div>

        {showTrips ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="w-full max-w-5xl mt-4">
            <div className="text-[11px] text-white/35 mb-3 px-1 font-medium uppercase tracking-wider">
              Chuyến đi của tôi {user ? "(theo tài khoản Google)" : "(lưu trên trình duyệt này)"}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {user
                ? accountTrips!.map((t) => (
                    <a
                      key={t.slug}
                      href={t.shareUrl}
                      className="group glass rounded-2xl overflow-hidden flex flex-col hover:border-accent/40 border border-transparent transition-colors"
                    >
                      <TripThumb photoUrl={t.photoUrl} />
                      <div className="p-3.5 flex flex-col gap-2">
                        <span className="text-sm font-semibold text-white/90 truncate">
                          {t.title || `${t.distanceKm.toFixed(1)} km · ${t.photoCount} ảnh`}
                        </span>
                        <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/10">
                          <span>{fmtDate(t.createdAt)}</span>
                          <span className="flex items-center gap-1">
                            <Route size={12} />
                            {t.distanceKm.toFixed(1)} km
                          </span>
                        </div>
                      </div>
                    </a>
                  ))
                : localTrips.map((t) => (
                    <a
                      key={t.slug}
                      href={t.editUrl}
                      className="group relative glass rounded-2xl overflow-hidden flex flex-col hover:border-accent/40 border border-transparent transition-colors"
                    >
                      <TripThumb photoUrl={t.photoUrl} />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          removeMyTrip(t.slug);
                        }}
                        title="Bỏ khỏi danh sách này (không xoá chuyến đi)"
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/60 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-black/70 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                      <div className="p-3.5 flex flex-col gap-2">
                        <span className="text-sm font-semibold text-white/90 truncate">
                          {t.distanceKm.toFixed(1)} km · {t.photoCount} ảnh
                        </span>
                        <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/10">
                          <span>{fmtDate(t.createdAt)}</span>
                          <span className="flex items-center gap-1">
                            <Route size={12} />
                            {t.distanceKm.toFixed(1)} km
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-center text-white/30 text-sm mt-4"
          >
            Chưa có chuyến đi nào. Bấm &ldquo;Tạo chuyến đi mới&rdquo; để bắt đầu.
          </motion.div>
        )}
      </main>
    </>
  );
}

// Card thumbnail for a "Chuyến đi của tôi" entry -- a real photo when one's
// known, a plain route icon placeholder when it isn't (e.g. an upload where
// every photo failed to compress and fall back, leaving no known public URL).
function TripThumb({ photoUrl }: { photoUrl: string | null }) {
  return (
    <div className="h-32 bg-white/[0.04] relative overflow-hidden shrink-0">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Route size={26} className="text-white/15" />
        </div>
      )}
    </div>
  );
}

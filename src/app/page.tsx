"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Route, Plus, ChevronRight } from "lucide-react";
import { useMyTrips, removeMyTrip } from "@/lib/my-trips";
import { useAuthUser } from "@/lib/use-auth-user";
import { staggerGrid, staggerItem } from "@/lib/motion";
import { DashboardShell } from "@/components/DashboardShell";
import { JourneyCard } from "@/components/JourneyCard";
import type { TripCardData } from "@/components/TripCard";

type AccountTrip = TripCardData & { shareUrl: string };

export default function Home() {
  const localTrips = useMyTrips();
  const { user } = useAuthUser();
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
    <DashboardShell active="home">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-14 mt-10 sm:mt-16 max-w-2xl"
      >
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-br from-primary via-gradient-pink to-accent-2 mb-5 drop-shadow-[0_10px_20px_rgba(255,95,143,0.25)]">
          Bắt đầu hành trình
          <br />
          của riêng bạn
        </h1>
        <p className="text-white/50 text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-8">
          Upload ảnh chuyến đi → tự tính lộ trình từ GPS trong ảnh → có link chia sẻ cho bạn bè xem lại.
        </p>
        {hasAccountTrips && (
          <div className="inline-flex items-center gap-1.5 mb-6 text-xs text-white/60 bg-white/[0.05] border border-white/10 px-3 py-1.5 rounded-full">
            <Route size={13} className="text-accent" />
            <span>
              <b className="text-white/85">{accountTrips!.length}</b> chuyến đi ·{" "}
              <b className="text-white/85">{totalKm.toFixed(0)}</b> km
            </span>
          </div>
        )}
        <div>
          <Link
            href="/upload"
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold bg-gradient-to-r from-accent to-gradient-pink text-neutral-950 shadow-lg shadow-accent/30 hover:brightness-105 active:scale-[0.97] transition-all duration-150 ease-snappy focus-ring"
          >
            <Plus size={18} strokeWidth={2.8} />
            Khởi hành ngay
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </motion.div>

      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[11px] text-muted font-medium uppercase tracking-wider">
            Hành trình gần đây {user ? "(theo tài khoản Google)" : "(lưu trên trình duyệt này)"}
          </h2>
          {showTrips && (
            <Link
              href="/journeys"
              className="text-[11px] text-accent-2 font-medium hover:text-accent transition-colors focus-ring"
            >
              Xem tất cả
            </Link>
          )}
        </div>

        {showTrips ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerGrid}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {user
              ? accountTrips!.slice(0, 6).map((t) => (
                  <motion.div key={t.slug} variants={staggerItem}>
                    <JourneyCard trip={t} href={t.shareUrl} />
                  </motion.div>
                ))
              : localTrips.slice(0, 6).map((t) => (
                  <motion.div key={t.slug} variants={staggerItem}>
                    <JourneyCard trip={{ ...t, title: null }} href={t.editUrl} onRemove={() => removeMyTrip(t.slug)} />
                  </motion.div>
                ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-center text-muted text-sm py-10 glass rounded-2xl"
          >
            Chưa có chuyến đi nào. Bấm &ldquo;Khởi hành ngay&rdquo; để bắt đầu.
          </motion.div>
        )}
      </div>

      <footer className="w-full max-w-5xl mt-20 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 text-center sm:text-left">
        <span className="text-sm font-bold text-primary">Tracking Phượt</span>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/help" className="text-xs text-muted hover:text-accent-2 transition-colors focus-ring">
            Trợ giúp &amp; Liên hệ
          </Link>
          <Link href="/terms" className="text-xs text-muted hover:text-accent-2 transition-colors focus-ring">
            Terms of Service
          </Link>
          <Link href="/privacy" className="text-xs text-muted hover:text-accent-2 transition-colors focus-ring">
            Privacy Policy
          </Link>
          <span title="Sắp ra mắt" className="text-xs text-muted/60">
            Road Safety Guide
          </span>
        </div>
        <span className="text-xs text-muted">© 2026 Tracking Phượt.</span>
      </footer>
    </DashboardShell>
  );
}

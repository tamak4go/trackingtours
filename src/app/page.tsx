"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Route } from "lucide-react";
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
        className="w-full max-w-5xl mt-10 sm:mt-14 mb-16 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center"
      >
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-foreground mb-5 text-balance">
            Bắt đầu <span className="text-accent">hành trình</span> của riêng bạn
          </h1>
          <p className="text-white/50 text-sm sm:text-base leading-relaxed max-w-md mb-7">
            Upload ảnh chuyến đi → tự tính lộ trình từ GPS trong ảnh → có link chia sẻ cho bạn bè xem lại.
          </p>
          {hasAccountTrips && (
            <div className="flex items-center gap-1.5 mb-7 text-xs text-white/60">
              <Route size={13} className="text-accent" />
              <span>
                <b className="font-mono tabular-nums text-white/85">{accountTrips!.length}</b> chuyến đi đã lưu ·{" "}
                <b className="font-mono tabular-nums text-white/85">{totalKm.toFixed(0)}</b> km
              </span>
            </div>
          )}
          <Link
            href="/upload"
            className="inline-flex items-center gap-3 pl-6 pr-5 py-3.5 rounded-md font-semibold text-sm uppercase tracking-wide bg-accent text-neutral-950 hover:brightness-105 active:scale-[0.97] transition-all duration-150 ease-snappy focus-ring"
          >
            Khởi hành ngay
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <RouteIllustration />
      </motion.div>

      <div className="w-full max-w-5xl">
        <div className="flex items-end justify-between mb-4 px-1">
          <h2 className="font-display text-lg text-foreground">
            Hành trình gần đây{" "}
            <span className="text-sm font-sans text-muted font-normal">
              {user ? "(theo tài khoản Google)" : "(lưu trên trình duyệt này)"}
            </span>
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
            className="flex items-center gap-3 text-muted text-sm py-6 border-t border-white/[0.06]"
          >
            <Route size={16} className="text-accent shrink-0" />
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
        </div>
        <span className="text-xs text-muted">© 2026 Tracking Phượt.</span>
      </footer>
    </DashboardShell>
  );
}

// Gives the hero an actual piece of the product to look at instead of empty
// space beside the headline -- a stylized version of the real route line
// TripView draws, not a generic icon-in-a-circle or stock illustration.
function RouteIllustration() {
  return (
    <div className="glass rounded-2xl p-6 hidden lg:block" aria-hidden="true">
      <svg viewBox="0 0 280 200" className="w-full h-auto" fill="none">
        <path
          d="M20 170 C 70 170, 60 100, 110 90 S 190 40, 180 20"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="1 9"
        />
        <path
          d="M20 170 C 70 170, 60 100, 110 90"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="20" cy="170" r="4" fill="var(--accent)" />
        <circle cx="110" cy="90" r="4" fill="var(--accent)" />
        <circle cx="180" cy="20" r="4" fill="none" stroke="var(--accent-2)" strokeWidth="2" strokeDasharray="2 2" />
      </svg>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06] text-xs text-muted">
        <span>Sa Pa → Hà Giang</span>
        <span className="text-accent font-semibold font-mono tabular-nums">312 km</span>
      </div>
    </div>
  );
}

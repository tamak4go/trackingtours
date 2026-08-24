"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Route,
  Trash2,
  Plus,
  Lock,
  Bell,
  LayoutDashboard,
  Map as MapIcon,
  GalleryHorizontal,
  Gauge,
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useMyTrips, removeMyTrip } from "@/lib/my-trips";
import { useAuthUser } from "@/lib/use-auth-user";
import { supabaseBrowser } from "@/lib/supabase-browser";

type AccountTrip = {
  slug: string;
  title: string | null;
  distanceKm: number;
  photoCount: number;
  isPublic: boolean;
  createdAt: string;
  shareUrl: string;
  photoUrl: string | null;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Sidebar/nav items below that don't correspond to a real page yet
// (Explore, Community, Map View, Gallery, Stats, Settings, Help, Upgrade to
// Pro) are intentionally inert -- no href, no handler -- rather than linking
// somewhere fake. They're here for the visual layout the design calls for;
// wiring them up is future work, not this pass.
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
  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || null;

  return (
    <>
      <div className="bg-mesh" />

      <nav className="sticky top-0 z-40 flex items-center justify-between px-5 sm:px-8 py-4 bg-black/20 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-primary drop-shadow-[0_0_15px_rgba(255,181,154,0.3)]">
            Tracking Phượt
          </span>
          <ul className="hidden md:flex gap-6 text-sm">
            <li className="font-bold text-primary border-b-2 border-primary pb-1 cursor-default">Home</li>
            <li className="text-white/50 font-medium hover:text-primary transition-colors cursor-pointer">My Journeys</li>
            <li className="text-white/50 font-medium hover:text-primary transition-colors cursor-pointer">Explore</li>
            <li className="text-white/50 font-medium hover:text-primary transition-colors cursor-pointer">Community</li>
          </ul>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-primary-container to-gradient-pink text-neutral-950 text-sm font-bold px-5 py-2.5 rounded-full shadow-[0_10px_30px_rgba(255,122,69,0.3)] hover:scale-95 transition-transform"
          >
            Start Ride
          </Link>
          <button title="Chưa có thông báo" className="text-white/50 hover:text-primary transition-colors">
            <Bell size={20} />
          </button>
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="w-9 h-9 rounded-full border-2 border-primary/60 shadow-[0_0_15px_rgba(255,181,154,0.4)] object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/10" />
          )}
        </div>
      </nav>

      {/* Right rail: desktop only, matching the design's fixed-right layout.
          Most items are placeholders (see note above) -- Dashboard and
          Logout are the only two wired to something real. */}
      <aside className="hidden lg:flex flex-col w-64 fixed right-0 top-[65px] bottom-0 py-8 px-6 bg-white/[0.02] backdrop-blur-2xl border-l border-white/[0.06] z-30">
        <div className="mb-8">
          <div className="text-lg font-bold text-primary mb-1">{displayName ? "Rider Profile" : "Khách"}</div>
          <div className="text-sm text-white/40 truncate">{displayName || "Đăng nhập để lưu chuyến đi vào tài khoản"}</div>
        </div>
        <nav className="flex-1 space-y-1">
          <div className="flex items-center gap-3 text-accent-2 font-semibold border-r-4 border-accent-2 pr-4 py-2">
            <LayoutDashboard size={18} />
            <span className="text-sm">Dashboard</span>
          </div>
          {[
            { icon: MapIcon, label: "Map View" },
            { icon: GalleryHorizontal, label: "Gallery" },
            { icon: Gauge, label: "Stats" },
            { icon: Settings, label: "Settings" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 text-white/40 hover:bg-white/[0.05] transition-colors py-2 px-2 rounded-lg cursor-pointer"
            >
              <Icon size={18} />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </nav>
        <div className="mt-auto space-y-4">
          <button
            title="Sắp ra mắt"
            className="w-full py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs font-semibold text-primary hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles size={13} />
            Upgrade to Pro
          </button>
          <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
            <div className="flex items-center gap-3 text-white/40 hover:text-primary transition-colors cursor-pointer text-sm">
              <HelpCircle size={16} />
              Help
            </div>
            {user && (
              <button
                onClick={() => supabaseBrowser().auth.signOut()}
                className="flex items-center gap-3 text-red-400/80 hover:text-red-400 transition-colors text-sm"
              >
                <LogOut size={16} />
                Logout
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col items-center lg:pr-64 p-6 relative">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 mt-10 sm:mt-16 max-w-2xl"
        >
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-br from-primary via-[#ff5f8f] to-accent-2 mb-5 drop-shadow-[0_10px_20px_rgba(255,95,143,0.25)]">
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
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold bg-gradient-to-r from-accent to-[#ff5f8f] text-neutral-950 shadow-lg shadow-accent/30 hover:brightness-105 active:scale-[0.98] transition-all"
            >
              <Plus size={18} strokeWidth={2.8} />
              Khởi hành ngay
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>

        <div className="w-full max-w-5xl">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="text-[11px] text-white/35 font-medium uppercase tracking-wider">
              Hành trình gần đây {user ? "(theo tài khoản Google)" : "(lưu trên trình duyệt này)"}
            </div>
          </div>

          {showTrips ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {user
                ? accountTrips!.map((t) => (
                    <a
                      key={t.slug}
                      href={t.shareUrl}
                      className="group glass rounded-2xl overflow-hidden flex flex-col hover:border-accent/40 border border-transparent transition-colors"
                    >
                      <TripThumb photoUrl={t.photoUrl} isPublic={t.isPublic} />
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
                      <TripThumb photoUrl={t.photoUrl} isPublic={t.isPublic} />
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
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-center text-white/30 text-sm py-10 glass rounded-2xl"
            >
              Chưa có chuyến đi nào. Bấm &ldquo;Khởi hành ngay&rdquo; để bắt đầu.
            </motion.div>
          )}
        </div>

        <footer className="w-full max-w-5xl mt-20 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 text-center sm:text-left">
          <span className="text-sm font-bold text-primary">Tracking Phượt</span>
          <div className="flex flex-wrap justify-center gap-4">
            {["Terms of Service", "Privacy Policy", "Contact Support", "Road Safety Guide"].map((label) => (
              <span key={label} className="text-xs text-white/35 hover:text-accent-2 transition-colors cursor-pointer">
                {label}
              </span>
            ))}
          </div>
          <span className="text-xs text-white/25">© 2026 Tracking Phượt.</span>
        </footer>
      </main>
    </>
  );
}

// Card thumbnail for a "Hành trình gần đây" entry -- a real photo when one's
// known, a plain route icon placeholder when it isn't (e.g. an upload where
// every photo failed to compress and fall back, leaving no known public URL).
function TripThumb({ photoUrl, isPublic }: { photoUrl: string | null; isPublic: boolean }) {
  return (
    <div className="h-32 bg-white/[0.04] relative overflow-hidden shrink-0">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Route size={26} className="text-white/15" />
        </div>
      )}
      {!isPublic && (
        <span
          title="Chuyến đi riêng tư"
          className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70"
        >
          <Lock size={12} />
        </span>
      )}
    </div>
  );
}

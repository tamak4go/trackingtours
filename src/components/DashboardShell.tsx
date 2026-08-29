"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Menu,
  X,
  Lock,
  Map as MapIcon,
  GalleryHorizontal,
  Gauge,
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuthUser } from "@/lib/use-auth-user";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { AuthButton } from "@/components/AuthButton";

const TOP_LINKS = [
  { key: "home", href: "/", label: "Home" },
  { key: "journeys", href: "/journeys", label: "My Journeys" },
  { key: "explore", href: "/explore", label: "Explore" },
  { key: "community", href: "/community", label: "Community" },
] as const;

// `gated: true` pages render a SignInPrompt for guests instead of content --
// still a real, navigable destination, just dimmed with a lock hint so
// guests aren't surprised after the click (critique: these rendered
// identically to fully-live links, no indication login is needed).
const SIDE_LINKS = [
  { key: "map", href: "/map", label: "Map View", icon: MapIcon, gated: true },
  { key: "gallery", href: "/gallery", label: "Gallery", icon: GalleryHorizontal, gated: true },
  { key: "stats", href: "/stats", label: "Stats", icon: Gauge, gated: true },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings, gated: false },
] as const;

export type NavKey = (typeof TOP_LINKS)[number]["key"] | (typeof SIDE_LINKS)[number]["key"] | "help";

// Shared dashboard chrome (top nav + right rail) for every page reachable
// from the home page's nav -- extracted from page.tsx so the nav/sidebar
// only exists in one place once it actually links somewhere. `active`
// highlights the current entry in whichever of the two nav lists it belongs
// to (a page can only be one, so a single prop covers both).
export function DashboardShell({ active, children }: { active: NavKey; children: React.ReactNode }) {
  const { user } = useAuthUser();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || null;

  return (
    <>
      <div className="bg-mesh" />

      <nav className="sticky top-0 z-40 flex items-center justify-between px-5 sm:px-8 py-4 bg-black/20 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-display font-semibold tracking-tight text-primary focus-ring rounded">
            Tracking Phượt
          </Link>
          <ul className="hidden lg:flex gap-6 text-sm">
            {TOP_LINKS.map((link) => (
              <li key={link.key}>
                <Link
                  href={link.href}
                  className={
                    active === link.key
                      ? "font-bold text-primary border-b-2 border-primary pb-1 focus-ring"
                      : "text-white/50 font-medium hover:text-primary transition-colors pb-1 focus-ring"
                  }
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className="hidden lg:flex items-center gap-1.5 bg-gradient-to-r from-primary-container to-gradient-pink text-neutral-950 text-sm font-bold px-5 py-2.5 rounded-full shadow-glow-accent hover:brightness-105 active:scale-[0.97] transition-all duration-150 ease-snappy focus-ring"
          >
            Start Ride
          </Link>
          <button
            title="Chưa có thông báo"
            aria-label="Thông báo (chưa có thông báo mới)"
            className="hidden sm:block p-2.5 -m-2.5 text-white/50 hover:text-primary active:scale-[0.9] transition-all duration-150 ease-snappy focus-ring"
          >
            <Bell size={20} />
          </button>
          <AuthButton />
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden p-2.5 -m-2.5 text-white/60 hover:text-primary active:scale-[0.9] transition-all duration-150 ease-snappy focus-ring"
            title="Menu"
            aria-label="Mở menu điều hướng"
          >
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile nav sheet: the right rail below is `lg:` only, so every link
          in it (plus the top nav's `md:` only tabs) would otherwise be
          unreachable on a phone. */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="absolute right-0 top-0 bottom-0 w-72 glass p-6 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="min-w-0">
                  <div className="text-base font-bold text-primary">{displayName ? "Rider Profile" : "Khách"}</div>
                  <div className="text-xs text-muted truncate max-w-[180px]">
                    {displayName || "Đăng nhập để lưu chuyến đi"}
                  </div>
                </div>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Đóng menu"
                  className="p-2 -m-2 text-white/50 hover:text-white active:scale-[0.9] transition-all duration-150 ease-snappy focus-ring shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
              <Link
                href="/upload"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-primary-container to-gradient-pink text-neutral-950 text-sm font-bold py-2.5 rounded-full shadow-glow-accent active:scale-[0.97] transition-all duration-150 ease-snappy focus-ring mb-4"
              >
                Start Ride
              </Link>
              <nav className="flex flex-col gap-1 text-sm">
                {TOP_LINKS.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={
                      active === link.key
                        ? "py-2.5 px-2 rounded-lg font-semibold text-accent-2 bg-white/[0.05] focus-ring"
                        : "py-2.5 px-2 rounded-lg text-white/60 hover:bg-white/[0.05] focus-ring"
                    }
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="my-2 border-t border-white/[0.06]" />
                {SIDE_LINKS.map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    onClick={() => setMobileNavOpen(false)}
                    title={link.gated && !user ? "Đăng nhập để xem" : undefined}
                    className={
                      active === link.key
                        ? "flex items-center gap-3 py-2.5 px-2 rounded-lg font-semibold text-accent-2 bg-white/[0.05] focus-ring"
                        : link.gated && !user
                          ? "flex items-center gap-3 py-2.5 px-2 rounded-lg text-white/35 hover:bg-white/[0.05] focus-ring"
                          : "flex items-center gap-3 py-2.5 px-2 rounded-lg text-white/60 hover:bg-white/[0.05] focus-ring"
                    }
                  >
                    <link.icon size={17} />
                    {link.label}
                    {link.gated && !user && <Lock size={12} className="ml-auto" />}
                  </Link>
                ))}
                <Link
                  href="/help"
                  onClick={() => setMobileNavOpen(false)}
                  className={
                    active === "help"
                      ? "flex items-center gap-3 py-2.5 px-2 rounded-lg font-semibold text-accent-2 bg-white/[0.05] focus-ring"
                      : "flex items-center gap-3 py-2.5 px-2 rounded-lg text-white/60 hover:bg-white/[0.05] focus-ring"
                  }
                >
                  <HelpCircle size={17} />
                  Help
                </Link>
              </nav>
              {user && (
                <button
                  onClick={() => supabaseBrowser().auth.signOut()}
                  className="mt-auto flex items-center gap-3 text-red-400/80 hover:text-red-400 transition-colors text-sm py-2.5 px-2 focus-ring"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="hidden lg:flex flex-col w-64 fixed right-0 top-[65px] bottom-0 py-8 px-6 bg-white/[0.02] backdrop-blur-2xl border-l border-white/[0.06] z-30">
        <div className="mb-8 min-w-0">
          <div className="text-lg font-bold text-primary mb-1">{displayName ? "Rider Profile" : "Khách"}</div>
          <div className="text-sm text-muted truncate">{displayName || "Đăng nhập để lưu chuyến đi vào tài khoản"}</div>
        </div>
        <nav className="flex-1 space-y-1">
          {SIDE_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              title={link.gated && !user ? "Đăng nhập để xem" : undefined}
              className={
                active === link.key
                  ? "flex items-center gap-3 text-accent-2 font-semibold border-r-4 border-accent-2 pr-4 py-2 focus-ring"
                  : link.gated && !user
                    ? "flex items-center gap-3 text-white/35 hover:bg-white/[0.05] transition-colors py-2 px-2 rounded-lg focus-ring"
                    : "flex items-center gap-3 text-muted hover:bg-white/[0.05] transition-colors py-2 px-2 rounded-lg focus-ring"
              }
            >
              <link.icon size={18} />
              <span className="text-sm">{link.label}</span>
              {link.gated && !user && <Lock size={12} className="ml-auto" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-4">
          <button
            disabled
            title="Sắp ra mắt"
            aria-label="Upgrade to Pro (sắp ra mắt)"
            className="w-full py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs font-semibold text-primary opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Sparkles size={13} />
            Upgrade to Pro
          </button>
          <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
            <Link
              href="/help"
              className={
                active === "help"
                  ? "flex items-center gap-3 text-accent-2 font-semibold transition-colors text-sm focus-ring"
                  : "flex items-center gap-3 text-muted hover:text-primary transition-colors text-sm focus-ring"
              }
            >
              <HelpCircle size={16} />
              Help
            </Link>
            {user && (
              <button
                onClick={() => supabaseBrowser().auth.signOut()}
                className="flex items-center gap-3 text-red-400/80 hover:text-red-400 transition-colors text-sm focus-ring"
              >
                <LogOut size={16} />
                Logout
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col items-center lg:pr-64 p-6 relative min-h-[calc(100vh-65px)]">{children}</main>
    </>
  );
}

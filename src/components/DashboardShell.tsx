"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Menu,
  X,
  LayoutDashboard,
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

const SIDE_LINKS = [
  { key: "dashboard", href: "/", label: "Dashboard", icon: LayoutDashboard },
  { key: "map", href: "/map", label: "Map View", icon: MapIcon },
  { key: "gallery", href: "/gallery", label: "Gallery", icon: GalleryHorizontal },
  { key: "stats", href: "/stats", label: "Stats", icon: Gauge },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
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
          <Link
            href="/"
            className="text-xl font-bold tracking-tighter text-primary drop-shadow-[0_0_15px_rgba(255,181,154,0.3)]"
          >
            Tracking Phượt
          </Link>
          <ul className="hidden lg:flex gap-6 text-sm">
            {TOP_LINKS.map((link) => (
              <li key={link.key}>
                <Link
                  href={link.href}
                  className={
                    active === link.key
                      ? "font-bold text-primary border-b-2 border-primary pb-1"
                      : "text-white/50 font-medium hover:text-primary transition-colors pb-1"
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
            className="hidden lg:flex items-center gap-1.5 bg-gradient-to-r from-primary-container to-gradient-pink text-neutral-950 text-sm font-bold px-5 py-2.5 rounded-full shadow-[0_10px_30px_rgba(255,122,69,0.3)] hover:scale-95 transition-transform"
          >
            Start Ride
          </Link>
          <button title="Chưa có thông báo" className="hidden sm:block p-2.5 -m-2.5 text-white/50 hover:text-primary transition-colors">
            <Bell size={20} />
          </button>
          <AuthButton />
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden p-2.5 -m-2.5 text-white/60 hover:text-primary transition-colors"
            title="Menu"
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
                <div>
                  <div className="text-base font-bold text-primary">{displayName ? "Rider Profile" : "Khách"}</div>
                  <div className="text-xs text-white/40 truncate max-w-[180px]">
                    {displayName || "Đăng nhập để lưu chuyến đi"}
                  </div>
                </div>
                <button onClick={() => setMobileNavOpen(false)} className="p-2 text-white/50 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <Link
                href="/upload"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-primary-container to-gradient-pink text-neutral-950 text-sm font-bold py-2.5 rounded-full shadow-[0_10px_30px_rgba(255,122,69,0.3)] mb-4"
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
                        ? "py-2.5 px-2 rounded-lg font-semibold text-accent-2 bg-white/[0.05]"
                        : "py-2.5 px-2 rounded-lg text-white/60 hover:bg-white/[0.05]"
                    }
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="my-2 border-t border-white/[0.06]" />
                {SIDE_LINKS.slice(1).map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={
                      active === link.key
                        ? "flex items-center gap-3 py-2.5 px-2 rounded-lg font-semibold text-accent-2 bg-white/[0.05]"
                        : "flex items-center gap-3 py-2.5 px-2 rounded-lg text-white/60 hover:bg-white/[0.05]"
                    }
                  >
                    <link.icon size={17} />
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="/help"
                  onClick={() => setMobileNavOpen(false)}
                  className={
                    active === "help"
                      ? "flex items-center gap-3 py-2.5 px-2 rounded-lg font-semibold text-accent-2 bg-white/[0.05]"
                      : "flex items-center gap-3 py-2.5 px-2 rounded-lg text-white/60 hover:bg-white/[0.05]"
                  }
                >
                  <HelpCircle size={17} />
                  Help
                </Link>
              </nav>
              {user && (
                <button
                  onClick={() => supabaseBrowser().auth.signOut()}
                  className="mt-auto flex items-center gap-3 text-red-400/80 hover:text-red-400 transition-colors text-sm py-2.5 px-2"
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
        <div className="mb-8">
          <div className="text-lg font-bold text-primary mb-1">{displayName ? "Rider Profile" : "Khách"}</div>
          <div className="text-sm text-white/40 truncate">{displayName || "Đăng nhập để lưu chuyến đi vào tài khoản"}</div>
        </div>
        <nav className="flex-1 space-y-1">
          {SIDE_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={
                active === link.key || (link.key === "dashboard" && active === "home")
                  ? "flex items-center gap-3 text-accent-2 font-semibold border-r-4 border-accent-2 pr-4 py-2"
                  : "flex items-center gap-3 text-white/40 hover:bg-white/[0.05] transition-colors py-2 px-2 rounded-lg"
              }
            >
              <link.icon size={18} />
              <span className="text-sm">{link.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-4">
          <button
            title="Sắp ra mắt"
            className="w-full py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-xs font-semibold text-primary cursor-default flex items-center justify-center gap-1.5"
          >
            <Sparkles size={13} />
            Upgrade to Pro
          </button>
          <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
            <Link
              href="/help"
              className={
                active === "help"
                  ? "flex items-center gap-3 text-accent-2 font-semibold transition-colors text-sm"
                  : "flex items-center gap-3 text-white/40 hover:text-primary transition-colors text-sm"
              }
            >
              <HelpCircle size={16} />
              Help
            </Link>
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

      <main className="flex-1 flex flex-col items-center lg:pr-64 p-6 relative min-h-[calc(100vh-65px)]">{children}</main>
    </>
  );
}

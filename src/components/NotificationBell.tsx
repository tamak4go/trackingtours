"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Bell, Heart } from "lucide-react";
import { useAuthUser } from "@/lib/use-auth-user";

type Notification = {
  id: string;
  tripSlug: string;
  tripTitle: string | null;
  type: string;
  read: boolean;
  createdAt: string;
};

function fmtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

// Real bell dropdown for signed-in owners (see /api/notifications and
// /api/trips/[slug]/like) -- notifications only exist for accounts, so a
// signed-out visitor still gets the old static "chưa có thông báo" bell
// rather than a dropdown with nothing behind it.
export function NotificationBell() {
  const { user } = useAuthUser();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next && unreadCount > 0) {
        setUnreadCount(0);
        setNotifications((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
        fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
      }
      return next;
    });
  }

  if (!user) {
    return (
      <button
        title="Chưa có thông báo"
        aria-label="Thông báo (chưa có thông báo mới)"
        className="hidden sm:block p-2.5 -m-2.5 text-white/50 hover:text-primary active:scale-[0.9] transition-all duration-150 ease-snappy focus-ring"
      >
        <Bell size={20} />
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        onClick={toggleOpen}
        title="Thông báo"
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative p-2.5 -m-2.5 text-white/50 hover:text-primary active:scale-[0.9] transition-all duration-150 ease-snappy focus-ring"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-2 ring-2 ring-black/60" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "top right" }}
            className="absolute top-full right-0 mt-3 z-40 glass rounded-2xl p-1.5 w-80 max-h-96 overflow-y-auto shadow-xl shadow-black/40"
          >
            {notifications === null ? (
              <div className="py-6 text-center text-sm text-muted">Đang tải...</div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted">Chưa có thông báo nào.</div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={`/t/${n.tripSlug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-white/[0.05] transition-colors"
                >
                  <Heart size={15} className="text-error mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }} />
                  <div className="min-w-0">
                    <div className="text-white/85">
                      Ai đó đã thả tim chuyến đi{" "}
                      <span className="font-semibold">{n.tripTitle || "của bạn"}</span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">{fmtRelative(n.createdAt)}</div>
                  </div>
                </Link>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

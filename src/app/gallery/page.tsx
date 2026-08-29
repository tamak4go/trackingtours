"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { GalleryHorizontal, Images, X } from "lucide-react";
import { useAuthUser } from "@/lib/use-auth-user";
import { DashboardShell } from "@/components/DashboardShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { StatusPanel } from "@/components/StatusPanel";

type GalleryPhoto = {
  id: string;
  url: string;
  takenAt: string | null;
  tripSlug: string;
  tripTitle: string | null;
};

export default function GalleryPage() {
  const { user, loaded } = useAuthUser();
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [active, setActive] = useState<GalleryPhoto | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/my-trips/photos")
      .then((res) => (res.ok ? res.json() : { photos: [] }))
      .then((data) => {
        if (!cancelled) setPhotos(data.photos ?? []);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!active) return;
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [active]);

  return (
    <DashboardShell active="gallery">
      <div className="w-full max-w-5xl mt-10 sm:mt-14">
        <div className="flex items-center gap-2.5 mb-2">
          <GalleryHorizontal size={22} className="text-accent-2" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95">Gallery</h1>
        </div>
        <p className="text-muted text-sm mb-8">Toàn bộ ảnh từ các chuyến đi đã lưu vào tài khoản của bạn.</p>

        {!loaded ? (
          <StatusPanel>Đang tải...</StatusPanel>
        ) : !user ? (
          <SignInPrompt reason="Gallery tổng hợp ảnh từ mọi chuyến đi trong tài khoản của bạn." />
        ) : photos === null ? (
          <StatusPanel>Đang tải...</StatusPanel>
        ) : photos.length === 0 ? (
          <StatusPanel icon={Images}>Chưa có ảnh nào. Tạo chuyến đi đầu tiên để bắt đầu Gallery.</StatusPanel>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-10">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p)}
                className="group relative aspect-square rounded-xl overflow-hidden bg-white/[0.04]"
              >
                <Image
                  src={p.url}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setActive(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-3xl w-full flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={active.url} alt="" className="max-h-[75vh] w-auto rounded-xl object-contain" />
              <div className="flex items-center justify-between w-full text-sm text-white/60">
                <Link href={`/t/${active.tripSlug}`} className="hover:text-accent-2 transition-colors truncate">
                  {active.tripTitle || "Xem chuyến đi"} →
                </Link>
                <button
                  onClick={() => setActive(null)}
                  aria-label="Đóng ảnh"
                  className="p-2 -m-2 text-white/50 hover:text-white active:scale-90 transition-all duration-150 ease-snappy"
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

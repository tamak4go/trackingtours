"use client";

import { Route, Lock, Trash2 } from "lucide-react";

export type TripCardData = {
  slug: string;
  title: string | null;
  distanceKm: number;
  photoCount: number;
  isPublic: boolean;
  createdAt: string;
  photoUrl: string | null;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// One trip tile, shared by every page that lists trips as a grid (home,
// My Journeys, Explore, Community). `onRemove`, when given, shows a hover
// button that unlists the trip locally (see removeMyTrip) -- it never
// deletes the trip itself, only anonymous/local trips have a use for it.
export function TripCard({ trip, href, onRemove }: { trip: TripCardData; href: string; onRemove?: () => void }) {
  return (
    <a
      href={href}
      className="group relative glass rounded-2xl overflow-hidden flex flex-col hover:border-accent/40 border border-transparent transition-colors"
    >
      <div className="h-32 bg-white/[0.04] relative overflow-hidden shrink-0">
        {trip.photoUrl ? (
          <img
            src={trip.photoUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Route size={26} className="text-white/15" />
          </div>
        )}
        {!trip.isPublic && (
          <span
            title="Chuyến đi riêng tư"
            className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70"
          >
            <Lock size={12} />
          </span>
        )}
      </div>
      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          title="Bỏ khỏi danh sách này (không xoá chuyến đi)"
          aria-label="Bỏ chuyến đi khỏi danh sách này"
          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-400 hover:bg-black/70 active:scale-90 transition-all duration-150 ease-snappy"
        >
          <Trash2 size={13} />
        </button>
      )}
      <div className="p-3.5 flex flex-col gap-2">
        <span className="text-sm font-semibold text-white/90 truncate">
          {trip.title || `${trip.distanceKm.toFixed(1)} km · ${trip.photoCount} ảnh`}
        </span>
        <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/10">
          <span>{fmtDate(trip.createdAt)}</span>
          <span className="flex items-center gap-1">
            <Route size={12} />
            {trip.distanceKm.toFixed(1)} km
          </span>
        </div>
      </div>
    </a>
  );
}

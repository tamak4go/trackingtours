"use client";

import { Images, Lock, Route, Trash2 } from "lucide-react";
import type { TripCardData } from "@/components/TripCard";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Large image-forward trip tile for Home and My Journeys. A single
// responsive card (grid-cols-1 on mobile in the parent grid) so it reads as
// a full-bleed feed card on phones and as a photo-grid tile once the parent
// grid goes multi-column -- no separate mobile/desktop code path needed.
// `onRemove`, when given, shows a hover button that unlists the trip locally
// (see removeMyTrip) -- it never deletes the trip itself, only anonymous/
// local trips have a use for it.
export function JourneyCard({
  trip,
  href,
  onRemove,
}: {
  trip: TripCardData;
  href: string;
  onRemove?: () => void;
}) {
  const title = trip.title || `${trip.distanceKm.toFixed(1)} km · ${trip.photoCount} ảnh`;
  const monogram = (trip.title || "").trim().slice(0, 1).toUpperCase();

  return (
    <a
      href={href}
      className="group relative flex h-52 sm:h-72 lg:h-80 flex-col overflow-hidden rounded-3xl border border-transparent bg-white/[0.03] transition-colors hover:border-primary/40"
    >
      {trip.photoUrl ? (
        <img
          src={trip.photoUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-white/[0.04]">
          <Route size={32} className="text-white/15" />
        </div>
      )}

      {monogram && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-2 -top-3 hidden select-none text-[100px] font-black leading-none lg:block"
          style={{ WebkitTextStroke: "1px rgba(255,255,255,0.14)", WebkitTextFillColor: "transparent" }}
        >
          {monogram}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

      <div className="pill absolute left-3 top-3 gap-1 text-[11px] font-medium text-white/90">
        <Images size={13} />
        {trip.photoCount}
      </div>

      {!trip.isPublic && (
        <span
          title="Chuyến đi riêng tư"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/70 backdrop-blur-sm"
        >
          <Lock size={12} />
        </span>
      )}

      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
          title="Bỏ khỏi danh sách này (không xoá chuyến đi)"
          className={`absolute right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-100 backdrop-blur-sm transition-all hover:bg-black/70 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 ${
            trip.isPublic ? "top-3" : "top-12"
          }`}
        >
          <Trash2 size={13} />
        </button>
      )}

      <div className="relative mt-auto flex flex-col gap-1.5 p-4 sm:p-5">
        <h3 className="truncate text-lg font-extrabold tracking-tight text-white drop-shadow-sm sm:text-xl">{title}</h3>
        <div className="flex items-center gap-3 text-xs text-white/60">
          <span>{fmtDate(trip.createdAt)}</span>
          <span className="flex items-center gap-1">
            <Route size={12} className="text-accent" />
            {trip.distanceKm.toFixed(1)} km
          </span>
        </div>
      </div>
    </a>
  );
}

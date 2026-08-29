"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Map as MlMap, NavigationControl, LngLatBounds } from "maplibre-gl";
import { Map as MapIcon, Route } from "lucide-react";
import { MAP_STYLE, ACCENT, ACCENT_GLOW } from "@/lib/map-style";
import { useAuthUser } from "@/lib/use-auth-user";
import { DashboardShell } from "@/components/DashboardShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { StatusPanel } from "@/components/StatusPanel";

type RouteTrip = {
  slug: string;
  title: string | null;
  distanceKm: number;
  routeMode: string;
  routeCoords: [number, number][];
  createdAt: string;
};

export default function MapViewPage() {
  const router = useRouter();
  const { user, loaded } = useAuthUser();
  const [trips, setTrips] = useState<RouteTrip[] | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/my-trips/routes")
      .then((res) => (res.ok ? res.json() : { trips: [] }))
      .then((data) => {
        if (!cancelled) setTrips(data.trips ?? []);
      })
      .catch(() => {
        if (!cancelled) setTrips([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!trips || !trips.length || !mapContainerRef.current || mapRef.current) return;

    const map = new MlMap({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: trips[0].routeCoords[0] ?? [106, 16],
      zoom: 5,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      let bounds: LngLatBounds | null = null;
      trips.forEach((t) => {
        map.addSource(`route-${t.slug}`, {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: t.routeCoords }, properties: {} },
        });
        map.addLayer({
          id: `route-${t.slug}-glow`,
          type: "line",
          source: `route-${t.slug}`,
          paint: { "line-color": ACCENT_GLOW, "line-width": 8, "line-blur": 6 },
        });
        map.addLayer({
          id: `route-${t.slug}-line`,
          type: "line",
          source: `route-${t.slug}`,
          paint: { "line-color": ACCENT, "line-width": 3 },
        });
        map.on("mouseenter", `route-${t.slug}-line`, () => {
          map.getCanvas().style.cursor = "pointer";
          setHovered(t.slug);
        });
        map.on("mouseleave", `route-${t.slug}-line`, () => {
          map.getCanvas().style.cursor = "";
          setHovered(null);
        });
        map.on("click", `route-${t.slug}-line`, () => {
          router.push(`/t/${t.slug}`);
        });

        for (const c of t.routeCoords) {
          bounds = bounds ? bounds.extend(c) : new LngLatBounds(c, c);
        }
      });
      if (bounds) map.fitBounds(bounds, { padding: 60, duration: 0 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [trips, router]);

  const hoveredTrip = trips?.find((t) => t.slug === hovered) ?? null;

  return (
    <DashboardShell active="map">
      <div className="w-full max-w-5xl mt-10 sm:mt-14 flex flex-col flex-1">
        <div className="flex items-center gap-2.5 mb-2">
          <MapIcon size={22} className="text-accent-2" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white/95">Map View</h1>
        </div>
        <p className="text-muted text-sm mb-6">Toàn bộ lộ trình đã lưu vào tài khoản, trên một bản đồ.</p>

        {!loaded ? (
          <StatusPanel>Đang tải...</StatusPanel>
        ) : !user ? (
          <SignInPrompt reason="Map View gộp lộ trình mọi chuyến đi trong tài khoản của bạn lên một bản đồ." />
        ) : trips === null ? (
          <StatusPanel>Đang tải...</StatusPanel>
        ) : trips.length === 0 ? (
          <StatusPanel icon={Route}>Chưa có chuyến đi nào có lộ trình để hiển thị.</StatusPanel>
        ) : (
          <div className="relative w-full flex-1 min-h-[420px] rounded-2xl overflow-hidden glass mb-10">
            {/* Inline style, not the Tailwind `absolute inset-0` classes: maplibre-gl.css
                adds its own `.maplibregl-map { position: relative }` rule to this same
                element (MapLibre reuses the container div), which wins the cascade on
                equal specificity and collapses this div to 0 height. Inline styles
                always beat stylesheet rules, so this is the robust fix regardless of
                import order -- see the same note in TripView.tsx. */}
            <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />
            {hoveredTrip && (
              <Link
                href={`/t/${hoveredTrip.slug}`}
                className="absolute bottom-4 left-4 glass rounded-xl px-4 py-2.5 text-sm z-10 pointer-events-none"
              >
                <div className="font-semibold text-white/90">{hoveredTrip.title || "Chuyến đi"}</div>
                <div className="text-white/50 text-xs">{hoveredTrip.distanceKm.toFixed(1)} km</div>
              </Link>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

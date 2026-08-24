"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Map as MlMap,
  Marker,
  NavigationControl,
  LngLatBounds,
  setWorkerUrl,
  getVersion,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import type { Trip, TripPhoto } from "@/lib/types";

// MapLibre lazily derives its worker script's URL from import.meta.url of its
// own bundled chunk. Under Next.js/Turbopack that chunk gets inlined into a
// shared bundle with a URL that has no matching /maplibre-gl-worker.mjs next
// to it, so the browser's module-worker fetch 404s (Next.js serves its HTML
// fallback page for that, which is the "non-JavaScript MIME type" error) and
// the worker silently never becomes ready -- the real cause of the map hanging
// forever, unrelated to vector vs. raster tiles. Point it at the exact same
// version hosted on a CDN instead (built from getVersion() so this can't
// drift out of sync with whatever maplibre-gl version actually ships).
setWorkerUrl(`https://cdn.jsdelivr.net/npm/maplibre-gl@${getVersion()}/dist/maplibre-gl-worker.mjs`);

// Raster tiles, not OpenFreeMap's vector style: MapLibre's vector-tile
// pipeline dispatches parsing to a Web Worker, and in both our own testing
// and on a real user's device that worker reliably never resolved a single
// tile (main-thread fetches to the exact same tile URLs succeeded fine, so
// it isn't the network or a CORS/bundler issue -- something in MapLibre's
// worker/dispatcher path itself hangs). Raster tiles are plain image
// requests handled on the main thread with no such dependency, trading the
// vector style's glow/dash styling for the map actually loading.
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      // Esri World Imagery -- free, no API key, no rate-limit issues in
      // practice. Note the {z}/{y}/{x} tile URL order: ArcGIS's convention,
      // swapped from the {z}/{x}/{y} every other tile provider here uses.
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "satellite-layer", type: "raster", source: "satellite" }],
};
const ACCENT = "#ff7a45";
const ACCENT_GLOW = "rgba(255, 122, 69, 0.6)";
const SECONDARY = "#75d1ff";
const SECONDARY_GLOW = "rgba(79, 195, 247, 0.4)";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  // Pinned to a fixed timeZone (not the environment's default) so the server
  // render (Vercel, UTC) and the client hydration render (browser, usually
  // Asia/Ho_Chi_Minh) produce identical text -- otherwise they disagree and
  // React throws a hydration mismatch (error #418).
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m ? m + "p" : ""}`;
}

function lerp(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

type Stop = { coordIdx: number; photo: TripPhoto };

function buildStops(routeCoords: [number, number][], photos: TripPhoto[]): Stop[] {
  if (!routeCoords.length) return [];
  const strideCap = Math.max(1, Math.floor(routeCoords.length / 500));
  return photos
    .map((p) => {
      let bestIdx = 0;
      let bestD = Infinity;
      for (let i = 0; i < routeCoords.length; i += strideCap) {
        const [lng, lat] = routeCoords[i];
        const d = (lat - p.lat) ** 2 + (lng - p.lng) ** 2;
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      return { coordIdx: bestIdx, photo: p };
    })
    .sort((a, b) => a.coordIdx - b.coordIdx);
}

// Builds the moving-marker DOM node imperatively (it's handed to a MapLibre
// Marker, not rendered by React) -- a badge with the ride icon and a CSS
// ripple, matching the Stitch "Journey Share View" mockup.
function buildMotoMarkerEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center border-2 border-primary-container relative" style="box-shadow: 0 0 15px rgba(255,122,69,0.8)">
      <span class="material-symbols-outlined text-primary-container text-xl" style="font-variation-settings:'FILL' 1">two_wheeler</span>
      <div class="absolute inset-0 rounded-full border border-primary-container animate-ping opacity-75"></div>
    </div>
  `;
  return el.firstElementChild as HTMLDivElement;
}

export function TripView({
  trip,
  editToken,
  canEdit,
}: {
  trip: Trip;
  // Present only when the share link carried ?edit=... -- still sent as a
  // query param on mutating requests when set, since that's what an
  // anonymous (not signed-in) owner authenticates with. A signed-in owner
  // has neither this nor needs it: the session cookie sent automatically
  // with same-origin fetch calls is what requireOwnedTrip falls back to.
  editToken: string | null;
  // Whether editing controls should show at all -- true if editToken is set
  // OR the current session belongs to the trip's owner (computed
  // server-side in t/[slug]/page.tsx, since only it can check that).
  canEdit: boolean;
}) {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const movingMarkerRef = useRef<Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const stopsRef = useRef<Stop[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [stopCard, setStopCard] = useState<TripPhoto | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<TripPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState(trip.title);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  // Edits to a photo's place name are kept as an id -> text overlay instead
  // of mutating trip.photos: the map markers below close over the original
  // trip.photos objects at creation time (they're only built once, in the
  // "load" effect), so replacing those objects on edit would leave the
  // markers' click handlers pointing at stale data. Looking the override up
  // by id at render time stays correct regardless of which object a given
  // click handler captured.
  const [placeOverrides, setPlaceOverrides] = useState<Record<string, string | null>>({});
  // MapLibre's sources/layers are only added once the "load" event fires
  // (see the effect below). On a slow connection that can take a while, and
  // tapping Play before then used to crash (map.getSource() returns
  // undefined pre-load) and leave the button stuck showing its loading icon
  // forever. Gate the button on this instead.
  const [mapReady, setMapReady] = useState(false);
  const [mapSlow, setMapSlow] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MlMap({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: trip.routeCoords[0] ?? [106, 16],
      zoom: 6,
    });
    mapRef.current = map;

    // Slow connections (seen as low as <1 KB/s in the field) can leave the
    // map's style/tiles loading for a very long time. Surface that instead
    // of leaving the user staring at a black screen with no explanation.
    const slowTimer = setTimeout(() => setMapSlow(true), 10000);

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("route-full", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: trip.routeCoords }, properties: {} },
      });
      const fullColor = trip.routeMode === "road" ? ACCENT : SECONDARY;
      const fullGlow = trip.routeMode === "road" ? ACCENT_GLOW : SECONDARY_GLOW;
      // Two stacked layers simulate the CSS drop-shadow glow from the mockup
      // (MapLibre's canvas doesn't support CSS filters): a wide, blurred
      // "halo" layer underneath the crisp line on top.
      map.addLayer({
        id: "route-full-glow",
        type: "line",
        source: "route-full",
        paint: { "line-color": fullGlow, "line-width": 12, "line-blur": 8 },
      });
      map.addLayer({
        id: "route-full-line",
        type: "line",
        source: "route-full",
        paint: {
          "line-color": fullColor,
          "line-width": trip.routeMode === "road" ? 4 : 3,
          "line-dasharray": trip.routeMode === "road" ? [1, 0] : [1.2, 1.2],
        },
      });

      map.addSource("route-progress", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: "route-progress-glow",
        type: "line",
        source: "route-progress",
        paint: { "line-color": ACCENT_GLOW, "line-width": 14, "line-blur": 10 },
      });
      map.addLayer({
        id: "route-progress-line",
        type: "line",
        source: "route-progress",
        paint: { "line-color": ACCENT, "line-width": 4 },
      });

      trip.photos.forEach((p) => {
        const el = document.createElement("div");
        el.className = "trip-stop-marker";
        el.title = p.takenAt ? fmtTime(p.takenAt) : p.id;
        el.addEventListener("click", () => setLightboxPhoto(p));
        new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
      });

      if (trip.routeCoords.length) {
        const bounds = trip.routeCoords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new LngLatBounds(trip.routeCoords[0], trip.routeCoords[0]),
        );
        map.fitBounds(bounds, { padding: 48, duration: 0 });
      }

      clearTimeout(slowTimer);
      setMapSlow(false);
      setMapReady(true);
    });

    return () => {
      clearTimeout(slowTimer);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey]);

  // Flies the map to a photo's shot location -- called alongside opening the
  // lightbox when a photo is tapped in the list, so the map stays in sync
  // with whichever photo is being viewed.
  function flyToPhoto(p: TripPhoto) {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 14) });
  }

  function playAnimation() {
    const map = mapRef.current;
    const coords = trip.routeCoords;
    if (!map || !mapReady || coords.length < 2 || isPlaying) return;

    const progressSource = map.getSource("route-progress") as GeoJSONSource | undefined;
    if (!progressSource) return; // load fired but this source wasn't added yet -- shouldn't happen, but don't crash if it does

    stopsRef.current = buildStops(coords, trip.photos);
    setIsPlaying(true);
    setHasPlayed(true);
    setStopCard(null);
    setProgressPct(0);

    if (movingMarkerRef.current) movingMarkerRef.current.remove();
    movingMarkerRef.current = new Marker({ element: buildMotoMarkerEl() }).setLngLat(coords[0]).addTo(map);

    progressSource.setData({ type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} });

    map.jumpTo({ center: coords[0], zoom: Math.max(map.getZoom(), 12) });

    const totalDurationMs = Math.min(Math.max(coords.length * 10, 6000), 25000);
    const stepMs = totalDurationMs / (coords.length - 1);

    const state = { idx: 0, lastTime: null as number | null, mode: "travel" as "travel" | "stopped", resumeAt: 0, stopPointer: 0 };

    const step = (ts: number) => {
      if (state.mode === "stopped") {
        if (ts >= state.resumeAt) {
          state.mode = "travel";
          state.lastTime = ts;
          setStopCard(null);
        }
        animFrameRef.current = requestAnimationFrame(step);
        return;
      }

      if (state.lastTime === null) state.lastTime = ts;
      const dt = ts - state.lastTime;
      state.lastTime = ts;
      state.idx = Math.min(state.idx + dt / stepMs, coords.length - 1);

      const i0 = Math.floor(state.idx);
      const i1 = Math.min(i0 + 1, coords.length - 1);
      const frac = state.idx - i0;
      const pos = lerp(coords[i0], coords[i1], frac);

      progressSource.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [...coords.slice(0, i0 + 1), pos] },
        properties: {},
      });
      movingMarkerRef.current?.setLngLat(pos);
      map.jumpTo({ center: pos });
      setProgressPct((state.idx / (coords.length - 1)) * 100);

      const stops = stopsRef.current;
      if (state.stopPointer < stops.length && stops[state.stopPointer].coordIdx <= state.idx) {
        setStopCard(stops[state.stopPointer].photo);
        state.stopPointer++;
        state.mode = "stopped";
        state.resumeAt = ts + 1500;
        animFrameRef.current = requestAnimationFrame(step);
        return;
      }

      if (state.idx >= coords.length - 1) {
        setIsPlaying(false);
        return;
      }
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // A signed-in owner authenticates via the session cookie fetch() already
  // sends same-origin -- no token query param needed. editToken (from
  // ?edit=... in the URL) is only appended when present, for the
  // anonymous-owner case.
  function tripApiUrl(path: string): string {
    return editToken ? `${path}?token=${encodeURIComponent(editToken)}` : path;
  }

  async function handleDelete() {
    if (!canEdit) return;
    if (!confirm("Xoá chuyến đi này? Không thể hoàn tác.")) return;
    setDeleting(true);
    try {
      const res = await fetch(tripApiUrl(`/api/trips/${trip.slug}`), { method: "DELETE" });
      if (res.ok) {
        router.push("/");
      } else {
        alert("Xoá thất bại.");
        setDeleting(false);
      }
    } catch {
      alert("Xoá thất bại.");
      setDeleting(false);
    }
  }

  function retryMap() {
    setMapReady(false);
    setMapSlow(false);
    setMapKey((k) => k + 1); // bumps the effect's dep, tearing down and recreating the Map instance
  }

  async function handleRename() {
    if (!canEdit) return;
    const next = prompt("Đổi tên chuyến đi:", title || "");
    if (next == null) return; // cancelled
    const trimmed = next.trim();
    if (!trimmed || trimmed === title) return;
    try {
      const res = await fetch(tripApiUrl(`/api/trips/${trip.slug}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        setTitle(trimmed);
      } else {
        alert("Đổi tên thất bại.");
      }
    } catch {
      alert("Đổi tên thất bại.");
    }
  }

  function placeNameOf(p: TripPhoto): string | null {
    return p.id in placeOverrides ? placeOverrides[p.id] : p.placeName;
  }

  async function handleEditPlaceName(p: TripPhoto) {
    if (!canEdit) return;
    const next = prompt("Tên địa điểm:", placeNameOf(p) || "");
    if (next == null) return; // cancelled
    const trimmed = next.trim();
    try {
      const res = await fetch(tripApiUrl(`/api/trips/${trip.slug}/photos/${p.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeName: trimmed }),
      });
      if (res.ok) {
        setPlaceOverrides((prev) => ({ ...prev, [p.id]: trimmed || null }));
      } else {
        alert("Cập nhật tên địa điểm thất bại.");
      }
    } catch {
      alert("Cập nhật tên địa điểm thất bại.");
    }
  }

  const avgSpeed = trip.durationMs > 0 ? trip.distanceKm / (trip.durationMs / 3600000) : null;
  const playLabel = !mapReady ? "Đang tải bản đồ..." : isPlaying ? "Đang phát..." : hasPlayed ? "Phát lại" : "Phát animation";
  const playIcon = !mapReady || isPlaying ? "hourglass_empty" : hasPlayed ? "replay" : "play_arrow";
  const canPlay = mapReady && !isPlaying && trip.routeCoords.length >= 2;

  function renderPhotoItem(p: TripPhoto, i: number) {
    const isActive = lightboxPhoto?.id === p.id || stopCard?.id === p.id;
    return (
      <div
        key={p.id}
        onClick={() => {
          flyToPhoto(p);
          setLightboxPhoto(p);
        }}
        className={`flex gap-3 group cursor-pointer p-2 rounded-lg transition-colors ${
          isActive ? "bg-surface-glass border border-primary-container/30" : "hover:bg-surface-glass border border-transparent"
        }`}
      >
        <div className="shrink-0 w-6 flex flex-col items-center">
          <div
            className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-container to-gradient-pink text-on-primary-container flex items-center justify-center text-[10px] font-bold"
            style={isActive ? { boxShadow: "0 0 10px rgba(255,122,69,0.5)" } : undefined}
          >
            {i + 1}
          </div>
          {i < trip.photos.length - 1 && <div className="w-px flex-1 bg-border-glass mt-1" />}
        </div>
        <div className="flex-1 min-w-0 pb-2">
          <img
            src={p.url}
            alt=""
            className={`w-full h-24 object-cover rounded-lg border transition-colors ${
              isActive ? "border-primary-container" : "border-border-glass group-hover:border-primary-container/50"
            }`}
          />
          <div className="mt-1.5 flex justify-between items-center">
            <span className={`text-xs ${isActive ? "text-primary" : "text-on-surface-variant"}`}>{fmtTime(p.takenAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh relative overflow-hidden bg-md-background text-on-surface">
      <style>{`
        .trip-stop-marker {
          width: 14px; height: 14px; border-radius: 50%;
          background: ${ACCENT}; border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,.5); cursor: pointer;
          transition: transform .15s ease;
        }
        .trip-stop-marker:hover { transform: scale(1.3); }
      `}</style>

      <main className="flex w-full h-full relative z-10">
        <div className="flex-1 relative">
          {/* Inline style, not the Tailwind `absolute inset-0` classes: maplibre-gl.css
              adds its own `.maplibregl-map { position: relative }` rule to this same
              element (MapLibre reuses the container div), and since that stylesheet is
              imported after Tailwind's utilities it wins the cascade on equal
              specificity -- collapsing this div to 0 height. Inline styles always beat
              stylesheet rules, so this is the robust fix regardless of import order. */}
          <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

          {mapSlow && !mapReady && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="glass rounded-2xl p-5 max-w-xs text-center pointer-events-auto">
                <p className="text-sm text-on-surface-variant mb-3">
                  Bản đồ tải hơi lâu — có thể do mạng yếu. Vẫn có thể đang tải, hoặc thử lại bên dưới.
                </p>
                <button
                  onClick={retryMap}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold glow-button text-neutral-950"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  Thử tải lại
                </button>
              </div>
            </div>
          )}

          {isPlaying && (
            <div className="absolute top-20 left-4 right-4 h-1 bg-white/15 rounded-full overflow-hidden z-10">
              <div
                className="h-full bg-gradient-to-r from-primary-container to-gradient-pink transition-all duration-150"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          <AnimatePresence>
            {stopCard && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="absolute left-4 bottom-4 w-64 glass rounded-xl p-3 flex flex-col gap-2 cursor-pointer z-10 shadow-xl shadow-black/40"
                onClick={() => setLightboxPhoto(stopCard)}
              >
                <img src={stopCard.url} alt="" className="w-full h-32 object-cover rounded-lg" />
                {placeNameOf(stopCard) && (
                  <div className="flex items-center gap-1 px-0.5 text-sm font-semibold truncate">
                    <span className="material-symbols-outlined text-primary-container text-sm shrink-0">location_on</span>
                    <span className="truncate">{placeNameOf(stopCard)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center px-0.5">
                  <span className="text-xs text-on-surface-variant">{fmtTime(stopCard.takenAt)}</span>
                  <span className="material-symbols-outlined text-secondary text-sm">photo_camera</span>
                </div>
                <span className="text-xs text-secondary font-medium">Chạm để xem ảnh lớn</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="hidden lg:flex flex-col w-80 h-full glass border-l border-border-glass bg-surface-container-low/80 relative z-20">
          <div className="p-4 border-b border-border-glass flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold">Hành trình ảnh</h3>
            <span className="text-xs text-on-surface-variant bg-surface-glass px-2 py-1 rounded">{trip.photos.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">{trip.photos.map(renderPhotoItem)}</div>
        </aside>

        {/* Mobile-only: the sidebar above is hidden below `lg`, so a floating
            button opens the same photo list as a bottom sheet instead. */}
        <button
          onClick={() => setMobileSheetOpen(true)}
          className="lg:hidden absolute bottom-4 right-4 z-30 glass w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-black/40"
        >
          <span className="material-symbols-outlined text-primary-container text-2xl">photo_library</span>
          <span className="absolute -top-1 -right-1 bg-gradient-to-br from-primary-container to-gradient-pink text-on-primary-container text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {trip.photos.length}
          </span>
        </button>

        <header className="absolute top-4 left-4 right-4 lg:right-[336px] z-30 glass rounded-full px-4 sm:px-6 py-3 flex items-center justify-between transition-all">
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            <span className="material-symbols-outlined text-primary-container text-2xl shrink-0">two_wheeler</span>
            <h1 className="text-sm sm:text-base font-bold tracking-tight truncate">{title || "Chuyến đi phượt"}</h1>
            {canEdit && (
              <button
                onClick={handleRename}
                className="text-on-surface-variant hover:text-primary-container transition-colors shrink-0"
                title="Đổi tên chuyến đi"
              >
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
            )}
          </div>

          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <button
              onClick={playAnimation}
              disabled={!canPlay}
              className="glow-button text-neutral-950 text-xs font-bold px-6 py-2 rounded-full flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                {playIcon}
              </span>
              {playLabel}
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={playAnimation}
              disabled={!canPlay}
              className="md:hidden glow-button text-neutral-950 w-8 h-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                {playIcon}
              </span>
            </button>

            <div className="hidden sm:flex gap-2">
              <div className="pill text-on-surface-variant text-xs gap-1.5 whitespace-nowrap">
                <span className="material-symbols-outlined text-sm text-secondary">route</span>
                <b className="text-on-surface font-semibold">{trip.distanceKm.toFixed(1)} km</b>
                <span className="opacity-70">{trip.routeMode === "road" ? "đường thực" : "đường thẳng"}</span>
              </div>
              <div className="pill text-on-surface-variant text-xs gap-1.5 whitespace-nowrap">
                <span className="material-symbols-outlined text-sm text-secondary">schedule</span>
                {fmtDuration(trip.durationMs)}
              </div>
              {avgSpeed && (
                <div className="pill text-on-surface-variant text-xs gap-1.5 whitespace-nowrap hidden xl:flex">
                  <span className="material-symbols-outlined text-sm text-secondary">speed</span>
                  {avgSpeed.toFixed(1)} km/h
                </div>
              )}
              <div className="pill text-on-surface-variant text-xs gap-1.5 whitespace-nowrap">
                <span className="material-symbols-outlined text-sm text-secondary">photo_library</span>
                {trip.photos.length} ảnh
              </div>
            </div>

            {canEdit && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 text-error hover:text-error-container transition-colors bg-surface-glass px-3 py-1.5 rounded-full ml-1 shrink-0 text-xs"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span className="hidden md:inline">{deleting ? "Đang xoá..." : "Xoá"}</span>
              </button>
            )}
          </div>
        </header>
      </main>

      <AnimatePresence>
        {mobileSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setMobileSheetOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setMobileSheetOpen(false);
              }}
              className="absolute bottom-0 left-0 right-0 max-h-[75vh] glass bg-surface-container-low/95 rounded-t-3xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 rounded-full bg-border-glass" />
              </div>
              <div className="px-4 pb-3 border-b border-border-glass flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold">Hành trình ảnh</h3>
                <span className="text-xs text-on-surface-variant bg-surface-glass px-2 py-1 rounded">{trip.photos.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">{trip.photos.map(renderPhotoItem)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center gap-6 p-6"
            onClick={() => setLightboxPhoto(null)}
          >
            <button
              className="absolute top-6 right-6 w-12 h-12 rounded-full glass flex items-center justify-center text-on-surface hover:text-primary-container transition-colors"
              onClick={() => setLightboxPhoto(null)}
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={lightboxPhoto.url}
              alt=""
              className="max-w-[90vw] max-h-[75vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {(placeNameOf(lightboxPhoto) || canEdit) && (
                <button
                  onClick={() => handleEditPlaceName(lightboxPhoto)}
                  disabled={!canEdit}
                  className="glass px-4 py-3 rounded-full flex items-center gap-2 disabled:cursor-default"
                >
                  <span className="material-symbols-outlined text-primary-container text-sm">location_on</span>
                  <span className="text-xs text-on-surface max-w-[40vw] truncate">
                    {placeNameOf(lightboxPhoto) || "Thêm tên địa điểm"}
                  </span>
                  {canEdit && <span className="material-symbols-outlined text-on-surface-variant text-sm">edit</span>}
                </button>
              )}
              <div className="glass px-4 py-3 rounded-full flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">schedule</span>
                <span className="text-xs text-on-surface-variant">{fmtTime(lightboxPhoto.takenAt)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

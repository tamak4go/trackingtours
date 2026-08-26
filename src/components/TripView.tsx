"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Map as MlMap, Marker, NavigationControl, LngLatBounds, type GeoJSONSource } from "maplibre-gl";
import { MAP_STYLE, ACCENT, ACCENT_GLOW, SECONDARY, SECONDARY_GLOW } from "@/lib/map-style";
import { compressPhoto } from "@/lib/process-photos";
import type { Trip, TripPhoto } from "@/lib/types";

const HEAD_TRAIL_POINTS = 40; // how many recent route points form the bright "comet head" behind the moving marker

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

// Small canvas helpers used only by the "smooth export" capture path below
// (drawCaptureFrame) -- there's no DOM/CSS to lean on there, everything the
// screen-recorded export gets for free (rounded corners, object-fit: cover)
// has to be drawn by hand.
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.naturalWidth / img.naturalHeight;
  const dr = w / h;
  let sx = 0,
    sy = 0,
    sw = img.naturalWidth,
    sh = img.naturalHeight;
  if (ir > dr) {
    sw = img.naturalHeight * dr;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / dr;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Simplified TikTok glyph (there's no "tiktok" symbol in material-symbols) --
// same 18px box as the other header icons so it lines up in the toolbar.
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className={className}>
      <path d="M16.6 5.82c-.94-.9-1.46-2.15-1.46-3.5h-3.28v13.66a2.59 2.59 0 0 1-2.59 2.5c-1.43 0-2.6-1.16-2.6-2.59 0-1.54 1.44-2.7 2.96-2.5V10.1c-3.28-.44-6.24 2.1-6.24 5.79A5.79 5.79 0 0 0 9.27 21.7a5.79 5.79 0 0 0 5.79-5.79V9.08a8.32 8.32 0 0 0 4.86 1.56V7.36a4.85 4.85 0 0 1-3.32-1.54Z" />
    </svg>
  );
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
// Marker, not rendered by React) -- a badge with the ride icon over a soft
// pulsing glow (see .moto-marker-glow in the component's <style> block),
// replacing the old hard-edged animate-ping ring with something that reads
// more like an engine glow than a sonar ping. `iconUrl`, when set (a custom
// upload or the owner's Google avatar -- see t/[slug]/page.tsx), renders as
// a circular photo badge instead of the default motorbike icon.
function buildMotoMarkerEl(iconUrl: string | null): HTMLDivElement {
  const el = document.createElement("div");
  const inner = iconUrl
    ? `<img src="${iconUrl}" alt="" class="w-full h-full rounded-full object-cover" />`
    : `<span class="material-symbols-outlined text-primary-container text-xl" style="font-variation-settings:'FILL' 1">two_wheeler</span>`;
  el.innerHTML = `
    <div class="moto-marker-glow w-10 h-10 bg-surface-container rounded-full flex items-center justify-center border-2 border-primary-container relative overflow-hidden">
      ${inner}
    </div>
  `;
  return el.firstElementChild as HTMLDivElement;
}

export function TripView({
  trip,
  editToken,
  canEdit,
  renderMode,
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
  // True only for the render service's headless Chromium (?render=1),
  // computed server-side in t/[slug]/page.tsx -- never read from
  // window.location here, so server and client render the same chrome-vs-no
  // -chrome output from the first paint with no hydration mismatch.
  renderMode: boolean;
}) {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const movingMarkerRef = useRef<Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  // Set by playAnimation(..., "manual") -- see the render-mode effect below.
  const manualStepRef = useRef<((ts: number) => void) | null>(null);
  const stopsRef = useRef<Stop[]>([]);
  // Off-screen canvas driving the "Xuất mượt" export path (drawCaptureFrame
  // paints into it every animation tick; recordAnimationVideoCanvas below
  // reads it via canvas.captureStream()). captureScaleRef is device pixels
  // per CSS pixel for that canvas, set once per recording so drawCaptureFrame
  // doesn't call getBoundingClientRect() on every frame.
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureScaleRef = useRef(1);
  // Photo <img> elements preloaded with crossOrigin so drawImageCover can
  // draw them into captureCanvasRef without tainting it (untainted is what
  // lets canvas.captureStream() actually include them in the output).
  const photoImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // Checked at the top of the rAF loop's step() (see playAnimation) --
  // pausing/resuming just flips this instead of tearing down and rebuilding
  // the whole animation state machine.
  const pausedRef = useRef(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [stopCard, setStopCard] = useState<TripPhoto | null>(null);
  const [stopCardDistanceKm, setStopCardDistanceKm] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  // Mirrors stopsRef below into real state -- the chapter dots on the
  // progress bar need to read it during render, and reading a ref's
  // .current during render isn't allowed (it's only safe from event
  // handlers/effects/animation-loop callbacks, which is what the ref
  // itself is still used for, in the rAF loop in playAnimation).
  const [stops, setStops] = useState<Stop[]>([]);
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
  // Manual override of display/list order (e.g. a camera with a wrong clock
  // put a photo out of sequence) -- kept separate from trip.photos so the
  // map effect below (which builds markers/stops from trip.photos once, on
  // "load") doesn't need to re-run just because the sidebar order changed.
  const [photos, setPhotos] = useState<TripPhoto[]>(trip.photos);
  const [isPublic, setIsPublic] = useState(trip.isPublic);
  const [recomputingRoute, setRecomputingRoute] = useState(false);
  // Moving-marker image shown during Play (see buildMotoMarkerEl) -- starts
  // as whatever t/[slug]/page.tsx resolved (custom upload, else the owner's
  // Google avatar, else null for the default icon) and updates immediately
  // on upload/reset without needing a full page reload.
  const [markerIconUrl, setMarkerIconUrl] = useState(trip.markerIconUrl);
  const [markerIconIsCustom, setMarkerIconIsCustom] = useState(trip.markerIconIsCustom);
  const [uploadingMarkerIcon, setUploadingMarkerIcon] = useState(false);
  const markerIconInputRef = useRef<HTMLInputElement>(null);
  // MapLibre's sources/layers are only added once the "load" event fires
  // (see the effect below). On a slow connection that can take a while, and
  // tapping Play before then used to crash (map.getSource() returns
  // undefined pre-load) and leave the button stuck showing its loading icon
  // forever. Gate the button on this instead.
  const [mapReady, setMapReady] = useState(false);
  const [mapSlow, setMapSlow] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  // Whether the server has TikTok credentials configured at all -- hides
  // the button entirely for deployments that never set them up, instead of
  // showing something that 501s.
  const [tiktokAvailable, setTiktokAvailable] = useState(false);
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [postingTikTok, setPostingTikTok] = useState(false);
  // Same idea as tiktokAvailable -- hides "Xuất chuẩn (server)" entirely for
  // deployments that never set up the render service, instead of showing a
  // button that 501s.
  const [renderServiceAvailable, setRenderServiceAvailable] = useState(false);
  // Secondary "..." menu grouping the export-video/TikTok actions -- these
  // used to be individual icon-only buttons crowding the header next to the
  // duration pill with no label, easy to misread as one confusing cluster.
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  // "Xuất chuẩn (server)" -- true while a job is in flight on the render
  // service (see exportVideoServer below). Separate from `recording`: this
  // one doesn't touch this tab's map/animation at all, the render service
  // loads its own headless copy of this same page.
  const [serverRendering, setServerRendering] = useState(false);

  // renderMode itself comes in as a prop (see t/[slug]/page.tsx), not from
  // reading window.location here, so it strips the interactive chrome
  // (header controls, sidebar, FAB -- see the JSX below) identically on the
  // server render and the client hydration, with no mismatch between them.
  //
  // This effect is what actually drives the render-mode headless browser:
  // once the map and its data sources are ready, it starts playAnimation
  // with driver "manual" and exposes window.__advanceFrame so Puppeteer can
  // step it one fixed-size tick at a time (see render-service/src/render.js).
  // Completion is signalled via document.body.dataset instead of a return
  // value/promise since Puppeteer polls the DOM from outside the page's JS
  // realm.
  useEffect(() => {
    if (!renderMode || !mapReady) return;
    const FRAME_DT_MS = 1000 / 30;
    let fakeTs = 0;
    (window as unknown as { __advanceFrame?: () => void }).__advanceFrame = () => {
      fakeTs += FRAME_DT_MS;
      manualStepRef.current?.(fakeTs);
    };
    const started = playAnimation(
      () => {
        document.body.dataset.renderDone = "1";
      },
      undefined,
      "manual",
    );
    if (started) (window as unknown as { __renderReady?: boolean }).__renderReady = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderMode, mapReady]);

  useEffect(() => {
    fetch("/api/tiktok/status")
      .then((r) => r.json())
      .then((d) => {
        setTiktokAvailable(Boolean(d.available));
        setTiktokConnected(Boolean(d.connected));
      })
      .catch(() => {});

    fetch("/api/render-video")
      .then((r) => r.json())
      .then((d) => setRenderServiceAvailable(Boolean(d.available)))
      .catch(() => {});

    // /api/tiktok/callback redirects back here with ?tiktok=connected|error
    // -- surface that once, then strip the param so a refresh doesn't
    // re-show the alert.
    const params = new URLSearchParams(window.location.search);
    const tiktokResult = params.get("tiktok");
    if (tiktokResult) {
      if (tiktokResult === "connected") alert("Đã kết nối TikTok!");
      else alert("Kết nối TikTok thất bại, thử lại nhé.");
      params.delete("tiktok");
      const qs = params.toString();
      router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closes the "..." menu on an outside click or Escape. `data-more-menu`
  // marks both trigger buttons and the panel itself, so a click landing on
  // any of them (including the trigger that just toggled it open) doesn't
  // immediately re-close it.
  useEffect(() => {
    if (!moreMenuOpen) return;
    function closeOnOutsideClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-more-menu]")) setMoreMenuOpen(false);
    }
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreMenuOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreMenuOpen]);

  // Preloads stop-card photos for the canvas export path (see
  // captureCanvasRef above) -- crossOrigin must be set before `src` is
  // assigned, or the browser fetches without it and the canvas ends up
  // tainted anyway. Supabase Storage's public bucket URLs already send
  // permissive CORS headers, same as the tile server MAP_STYLE points at.
  useEffect(() => {
    const map = new Map<string, HTMLImageElement>();
    trip.photos.forEach((p) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = p.url;
      map.set(p.id, img);
    });
    photoImagesRef.current = map;
  }, [trip.photos]);

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

      // A short, brighter "hot head" segment layered on top of the traveled
      // path -- just the last ~40 points, thicker and more opaque -- so the
      // trail reads as a comet fading into the cooler line behind it rather
      // than a flat uniform stroke.
      map.addSource("route-progress-head", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: "route-progress-head-line",
        type: "line",
        source: "route-progress-head",
        paint: { "line-color": "#ffd9c2", "line-width": 5, "line-opacity": 0.9 },
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

  // onDone fires exactly once, right when the route finishes playing --
  // used by exportVideo() below to know precisely when to stop recording,
  // without polling isPlaying/showComplete state from outside.
  // onFrame fires every tick with the data drawCaptureFrame needs (position,
  // progress, active stop card) computed synchronously here -- the canvas
  // export path (recordAnimationVideoCanvas) can't wait for these values to
  // round-trip through React state/re-render, it needs them the instant this
  // tick decides them.
  // driver "raf" (default) is the normal Play button: the browser paces
  // ticks in real time via requestAnimationFrame. driver "manual" is for the
  // server-side render pipeline (see the render-mode effect below): nothing
  // schedules the next tick automatically -- manualStepRef is exposed so an
  // external caller (Puppeteer, via window.__advanceFrame) can step the
  // exact same state machine one fixed-size tick at a time, with no wall
  // clock involved at all. That's what makes the server export frame-exact
  // regardless of how fast or slow the render machine actually runs.
  function playAnimation(
    onDone?: () => void,
    onFrame?: (frame: { pos: [number, number]; progressPct: number; activeStop: { photo: TripPhoto; distanceKm: number } | null }) => void,
    driver: "raf" | "manual" = "raf",
  ): boolean {
    const map = mapRef.current;
    const coords = trip.routeCoords;
    if (!map || !mapReady || coords.length < 2 || isPlaying) return false;

    const progressSource = map.getSource("route-progress") as GeoJSONSource | undefined;
    const headSource = map.getSource("route-progress-head") as GeoJSONSource | undefined;
    if (!progressSource || !headSource) return false; // load fired but these sources weren't added yet -- shouldn't happen, but don't crash if it does

    const computedStops = buildStops(coords, trip.photos);
    stopsRef.current = computedStops;
    setStops(computedStops);
    setIsPlaying(true);
    pausedRef.current = false;
    setIsPaused(false);
    setHasPlayed(true);
    setStopCard(null);
    setShowComplete(false);
    setProgressPct(0);

    if (movingMarkerRef.current) movingMarkerRef.current.remove();
    movingMarkerRef.current = new Marker({ element: buildMotoMarkerEl(markerIconUrl) }).setLngLat(coords[0]).addTo(map);

    progressSource.setData({ type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} });
    headSource.setData({ type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} });

    map.jumpTo({ center: coords[0], zoom: Math.max(map.getZoom(), 12) });

    const totalDurationMs = Math.min(Math.max(coords.length * 10, 6000), 25000);
    const stepMs = totalDurationMs / (coords.length - 1);

    const state = {
      idx: 0,
      lastTime: null as number | null,
      mode: "travel" as "travel" | "stopped",
      resumeAt: 0,
      stopPointer: 0,
      pos: coords[0] as [number, number],
      activeStop: null as { photo: TripPhoto; distanceKm: number } | null,
    };

    // In manual mode there's no wall clock to schedule against -- the next
    // tick only happens when the external driver calls manualStepRef.current
    // again (see the render-mode effect below), so this is a no-op.
    const scheduleNext = () => {
      if (driver === "raf") animFrameRef.current = requestAnimationFrame(step);
    };

    const step = (ts: number) => {
      // Pausing just freezes the loop here instead of cancelling it -- state
      // is untouched, and clearing lastTime means the tick right after
      // resuming computes a normal small dt instead of one covering the
      // entire paused duration (which would jump the marker forward).
      if (pausedRef.current) {
        state.lastTime = null;
        scheduleNext();
        return;
      }

      if (state.mode === "stopped") {
        if (ts >= state.resumeAt) {
          state.mode = "travel";
          state.lastTime = ts;
          state.activeStop = null;
          setStopCard(null);
        }
        onFrame?.({ pos: state.pos, progressPct: (state.idx / (coords.length - 1)) * 100, activeStop: state.activeStop });
        scheduleNext();
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
      state.pos = pos;

      const traveled = [...coords.slice(0, i0 + 1), pos];
      progressSource.setData({ type: "Feature", geometry: { type: "LineString", coordinates: traveled }, properties: {} });
      headSource.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: traveled.slice(-HEAD_TRAIL_POINTS) },
        properties: {},
      });
      movingMarkerRef.current?.setLngLat(pos);
      map.jumpTo({ center: pos });
      const pct = (state.idx / (coords.length - 1)) * 100;
      setProgressPct(pct);

      const stops = stopsRef.current;
      if (state.stopPointer < stops.length && stops[state.stopPointer].coordIdx <= state.idx) {
        const distanceKm = (state.idx / (coords.length - 1)) * trip.distanceKm;
        setStopCard(stops[state.stopPointer].photo);
        setStopCardDistanceKm(distanceKm);
        state.activeStop = { photo: stops[state.stopPointer].photo, distanceKm };
        state.stopPointer++;
        state.mode = "stopped";
        state.resumeAt = ts + 1500;
        onFrame?.({ pos, progressPct: pct, activeStop: state.activeStop });
        scheduleNext();
        return;
      }

      onFrame?.({ pos, progressPct: pct, activeStop: state.activeStop });

      if (state.idx >= coords.length - 1) {
        setIsPlaying(false);
        setShowComplete(true);
        onDone?.();
        return;
      }
      scheduleNext();
    };

    if (driver === "manual") {
      manualStepRef.current = step;
    } else {
      animFrameRef.current = requestAnimationFrame(step);
    }
    return true;
  }

  // Pause/resume just flip pausedRef -- see the check at the top of step()
  // above. Only meaningful for the real Play button (driver "raf"); the
  // server render pipeline never touches these.
  function pauseAnimation() {
    if (!isPlaying || pausedRef.current) return;
    pausedRef.current = true;
    setIsPaused(true);
  }

  function resumeAnimation() {
    if (!isPlaying || !pausedRef.current) return;
    pausedRef.current = false;
    setIsPaused(false);
  }

  // "Xuất nhanh": records the Play animation as a video Blob by screen/tab
  // capture. The moving marker, stop cards, and progress bar are all
  // separate DOM elements layered over MapLibre's canvas (that's how
  // MapLibre markers and our own React overlays work) -- so capturing just
  // the map's <canvas> would miss most of what makes the animation worth
  // sharing. getDisplayMedia records everything exactly as it's composited
  // on screen, no re-implementation needed -- but it always requires one
  // native browser permission prompt per recording, and the output's
  // smoothness rides on however busy the OS/tab compositor happens to be
  // during that particular capture (dropped frames, screen scaling, other
  // windows) rather than on anything this app controls. recordAnimationVideoCanvas
  // below ("Xuất mượt") trades the free composited overlays for a
  // hand-drawn canvas that sidesteps all of that. Shared by exportVideo
  // (download/share sheet) and postToTikTok (upload) below so the capture
  // logic only exists once.
  async function recordAnimationVideo(): Promise<Blob | null> {
    if (!canPlay || recording || isPlaying) return null;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      alert("Trình duyệt này không hỗ trợ quay video. Thử trên Chrome/Edge (máy tính hoặc Android).");
      return null;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        // Chrome-only hint that preselects "this tab" in the picker so
        // there's less to get wrong -- ignored harmlessly elsewhere.
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);
    } catch {
      return null; // user cancelled the share picker -- not an error
    }

    const mimeType =
      ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let stopped = false;
    const stopRecording = () => {
      if (stopped) return;
      stopped = true;
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
    };

    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        setRecording(false);
        resolve(chunks.length ? new Blob(chunks, { type: mimeType || "video/webm" }) : null);
      };
      // Covers the user ending the capture via the browser's own "Stop
      // sharing" control instead of waiting for playback to finish.
      stream.getVideoTracks()[0]?.addEventListener("ended", stopRecording);

      recorder.start();
      setRecording(true);
      if (!playAnimation(stopRecording)) stopRecording();
    });
    return blob;
  }

  // Shared by all three export paths (screen-recorded, canvas, server) --
  // they only differ in how the Blob gets made, not in what happens to it
  // afterward.
  async function shareOrDownloadVideo(blob: Blob, ext: string) {
    const filename = `${(title || "chuyen-di").replace(/[\\/:*?"<>|]/g, "").trim() || "chuyen-di"}.${ext}`;
    const file = new File([blob], filename, { type: blob.type });

    // On mobile, hand the clip to the OS share sheet so the user can pick
    // TikTok (or anything else) directly -- no TikTok account/API needed.
    // Falls back to a plain download wherever Web Share's file support
    // isn't there (most desktop browsers), and also if share() itself
    // throws: Web Share requires a live user-activation window from the
    // click, but the export above just spent the whole animation's length
    // (or a server round trip) producing the blob, so that window has
    // usually expired by the time we get here -- share() rejects with no
    // picker ever shown, which would otherwise look identical to a silent
    // no-op with nothing saved and no error.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: title || "Chuyến đi phượt" });
        return;
      } catch {
        // fall through to direct download below
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportVideo() {
    const blob = await recordAnimationVideo();
    if (!blob) return;
    await shareOrDownloadVideo(blob, "webm");
  }

  // Paints one frame of the "Xuất mượt" export onto captureCanvasRef: the
  // map's own canvas plus hand-drawn versions of the moving marker, progress
  // bar/chapter dots, and stop card -- everything recordAnimationVideo above
  // gets for free from the DOM/CSS. Called synchronously from playAnimation's
  // onFrame every tick, so it always draws the same position React is about
  // to (asynchronously) render, never a stale one.
  function drawCaptureFrame(frame: {
    pos: [number, number];
    progressPct: number;
    activeStop: { photo: TripPhoto; distanceKm: number } | null;
  }) {
    const canvas = captureCanvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const scale = captureScaleRef.current;

    // The map's own <canvas> is already exactly what's on screen -- just
    // stretch its full backing-store resolution onto ours (both are in
    // device pixels, so this stays crisp regardless of devicePixelRatio).
    const mapCanvas = map.getCanvas();
    ctx.drawImage(mapCanvas, 0, 0, mapCanvas.width, mapCanvas.height, 0, 0, W, H);

    // Moving marker: a glowing dot standing in for the .moto-marker-glow DOM
    // badge (see buildMotoMarkerEl) -- close in spirit, not a pixel clone.
    const screenPt = map.project(frame.pos);
    const mx = screenPt.x * scale;
    const my = screenPt.y * scale;
    ctx.save();
    ctx.shadowColor = ACCENT_GLOW;
    ctx.shadowBlur = 18 * scale;
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.arc(mx, my, 16 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2 * scale;
    ctx.strokeStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(mx, my, 16 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(mx, my, 5 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Progress bar + chapter dots, mirroring the JSX around `isPlaying &&`.
    const marginX = 16 * scale;
    const barY = 84 * scale;
    const barH = 4 * scale;
    const barW = W - marginX * 2;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    roundRectPath(ctx, marginX, barY, barW, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = ACCENT;
    roundRectPath(ctx, marginX, barY, barW * Math.min(frame.progressPct / 100, 1), barH, barH / 2);
    ctx.fill();
    const coords = trip.routeCoords;
    if (coords.length > 1) {
      for (const stop of stopsRef.current) {
        const pct = (stop.coordIdx / (coords.length - 1)) * 100;
        const visited = frame.progressPct >= pct;
        ctx.fillStyle = visited ? ACCENT : "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(marginX + barW * (pct / 100), barY + barH / 2, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Stop card, mirroring the <motion.div> block around `{stopCard && ...}`.
    if (frame.activeStop) {
      const cardW = 260 * scale;
      const photoH = 120 * scale;
      const padding = 12 * scale;
      const cardX = 16 * scale;
      const textLines = 3;
      const cardH = photoH + padding * 2 + textLines * 18 * scale;
      const cardY = H - cardH - 16 * scale;

      ctx.save();
      ctx.fillStyle = "rgba(28,25,23,0.72)";
      roundRectPath(ctx, cardX, cardY, cardW, cardH, 16 * scale);
      ctx.fill();

      roundRectPath(ctx, cardX + padding, cardY + padding, cardW - padding * 2, photoH, 10 * scale);
      ctx.clip();
      const img = photoImagesRef.current.get(frame.activeStop.photo.id);
      if (img && img.complete && img.naturalWidth) {
        drawImageCover(ctx, img, cardX + padding, cardY + padding, cardW - padding * 2, photoH);
      } else {
        ctx.fillStyle = "#292524";
        ctx.fillRect(cardX + padding, cardY + padding, cardW - padding * 2, photoH);
      }
      ctx.restore();

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const badge = `${frame.activeStop.distanceKm.toFixed(1)} km`;
      ctx.font = `${11 * scale}px sans-serif`;
      const badgeW = ctx.measureText(badge).width + 12 * scale;
      roundRectPath(
        ctx,
        cardX + cardW - padding - badgeW,
        cardY + padding + photoH - 22 * scale,
        badgeW,
        16 * scale,
        4 * scale,
      );
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textBaseline = "middle";
      ctx.fillText(badge, cardX + cardW - padding - badgeW + 6 * scale, cardY + padding + photoH - 14 * scale);

      const placeName = placeNameOf(frame.activeStop.photo);
      let lineY = cardY + padding + photoH + 20 * scale;
      if (placeName) {
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${13 * scale}px sans-serif`;
        ctx.fillText(placeName, cardX + padding, lineY, cardW - padding * 2);
        lineY += 18 * scale;
      }
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `${11 * scale}px sans-serif`;
      ctx.fillText(fmtTime(frame.activeStop.photo.takenAt), cardX + padding, lineY);
    }
  }

  // "Xuất mượt": same animation, but drawn frame-by-frame onto
  // captureCanvasRef (see drawCaptureFrame) and captured via
  // canvas.captureStream() instead of getDisplayMedia. No permission prompt,
  // and the frame rate is whatever this app hands MediaRecorder rather than
  // whatever the OS compositor was doing at the time -- trading
  // recordAnimationVideo's free DOM-composited overlays for output that
  // doesn't depend on how busy the rest of the screen was during capture.
  async function recordAnimationVideoCanvas(): Promise<Blob | null> {
    if (!canPlay || recording || isPlaying) return null;
    const map = mapRef.current;
    const container = mapContainerRef.current;
    const canvas = captureCanvasRef.current;
    if (!map || !container || !canvas) return null;
    if (typeof canvas.captureStream !== "function") {
      alert("Trình duyệt này không hỗ trợ xuất video mượt. Thử 'Xuất nhanh' thay thế.");
      return null;
    }

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    captureScaleRef.current = dpr;

    const stream = canvas.captureStream(30);
    const mimeType =
      ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let stopped = false;
    const stopRecording = () => {
      if (stopped) return;
      stopped = true;
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
    };

    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        setRecording(false);
        resolve(chunks.length ? new Blob(chunks, { type: mimeType || "video/webm" }) : null);
      };
      recorder.start();
      setRecording(true);
      if (!playAnimation(stopRecording, drawCaptureFrame)) stopRecording();
    });
    return blob;
  }

  async function exportVideoCanvas() {
    const blob = await recordAnimationVideoCanvas();
    if (!blob) return;
    await shareOrDownloadVideo(blob, "webm");
  }

  // "Xuất chuẩn (server)": asks the render service (see render-service/, a
  // separate Puppeteer+ffmpeg deployment -- Next.js API routes can't run
  // either) to render this trip itself, headlessly, frame-by-frame with no
  // wall clock -- see the renderMode effect above for the deterministic
  // stepping this relies on. Slower than the two client-side exports (a
  // render job takes at least as long as the animation itself, often
  // longer on a free-tier CPU) but the only one whose output doesn't depend
  // on this device's performance at all, since nothing about this device
  // touches the actual rendering.
  async function exportVideoServer() {
    if (!canPlay || serverRendering) return;
    setServerRendering(true);
    try {
      const startRes = await fetch(tripApiUrl("/api/render-video"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: trip.slug }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({}));
        alert(err.error || "Không khởi động được xuất video server.");
        return;
      }
      const { jobId } = (await startRes.json()) as { jobId: string };

      // Polls rather than a websocket/SSE -- a render job is a one-shot
      // background task lasting well under a minute, not worth a
      // persistent connection for.
      for (;;) {
        await new Promise((r) => setTimeout(r, 2500));
        const statusRes = await fetch(`/api/render-video/${encodeURIComponent(jobId)}`);
        if (!statusRes.ok) {
          alert("Mất kết nối tới dịch vụ xuất video.");
          return;
        }
        const job = (await statusRes.json()) as { status: string; videoUrl?: string; error?: string };
        if (job.status === "done" && job.videoUrl) {
          const videoRes = await fetch(job.videoUrl);
          const blob = await videoRes.blob();
          await shareOrDownloadVideo(blob, "mp4");
          return;
        }
        if (job.status === "error") {
          alert(job.error || "Xuất video server thất bại.");
          return;
        }
        // "queued" | "rendering" -- keep polling.
      }
    } catch {
      alert("Xuất video server thất bại.");
    } finally {
      setServerRendering(false);
    }
  }

  // Connects this browser to TikTok (see /api/tiktok/auth) so postToTikTok
  // can post without a share-sheet round trip.
  function connectTikTok() {
    window.location.href = `/api/tiktok/auth?return_to=${encodeURIComponent(window.location.pathname)}`;
  }

  async function disconnectTikTok() {
    await fetch("/api/tiktok/disconnect", { method: "POST" });
    setTiktokConnected(false);
  }

  // Records the animation, then uploads it straight to the connected
  // TikTok account via the Content Posting API (see src/lib/tiktok.ts).
  // CAVEAT surfaced in the alert below: an unaudited app can only deliver
  // to the user's TikTok inbox as a draft -- they still open the TikTok app
  // and tap Đăng themselves. There's no API path around that.
  async function postToTikTok() {
    if (postingTikTok) return;
    const blob = await recordAnimationVideo();
    if (!blob) return;

    setPostingTikTok(true);
    try {
      const res = await fetch(`/api/tiktok/upload?title=${encodeURIComponent(title || "Chuyến đi phượt")}`, {
        method: "POST",
        body: blob,
      });
      if (res.ok) {
        alert("Đã gửi video vào TikTok! Mở app TikTok > Hộp thư đến > Bản nháp để hoàn tất đăng.");
      } else {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setTiktokConnected(false);
          alert("Phiên TikTok đã hết hạn, hãy kết nối lại.");
        } else {
          alert(err.error || "Đăng lên TikTok thất bại.");
        }
      }
    } catch {
      alert("Đăng lên TikTok thất bại.");
    } finally {
      setPostingTikTok(false);
    }
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

  async function handleTogglePrivacy() {
    if (!canEdit) return;
    const next = !isPublic;
    try {
      const res = await fetch(tripApiUrl(`/api/trips/${trip.slug}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (res.ok) {
        setIsPublic(next);
      } else {
        alert("Đổi chế độ riêng tư thất bại.");
      }
    } catch {
      alert("Đổi chế độ riêng tư thất bại.");
    }
  }

  // Reads the picked file, downsizes it to a small square-ish avatar (no
  // need for photo-gallery resolution -- it only ever renders inside a
  // 40x40px marker badge) and uploads it as the trip's moving-marker image.
  async function handleMarkerIconFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets picking the same file again re-fire onChange
    if (!file || !canEdit) return;
    setUploadingMarkerIcon(true);
    try {
      const blob = await compressPhoto(file, { maxWidthOrHeight: 256, maxSizeMB: 0.15 });
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const res = await fetch(tripApiUrl(`/api/trips/${trip.slug}/marker-icon`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        setMarkerIconUrl(url);
        setMarkerIconIsCustom(true);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Đổi ảnh xe chạy thất bại.");
      }
    } catch {
      alert("Đổi ảnh xe chạy thất bại.");
    } finally {
      setUploadingMarkerIcon(false);
    }
  }

  async function handleResetMarkerIcon() {
    if (!canEdit) return;
    try {
      const res = await fetch(tripApiUrl(`/api/trips/${trip.slug}/marker-icon`), { method: "DELETE" });
      if (res.ok) {
        // The fallback (owner's Google avatar, or null for the default
        // icon) is resolved server-side in t/[slug]/page.tsx, not sent back
        // here -- simplest correct way to pick it back up is a reload,
        // same approach handleRecomputeRoute below already uses.
        window.location.reload();
      } else {
        alert("Đặt lại ảnh mặc định thất bại.");
      }
    } catch {
      alert("Đặt lại ảnh mặc định thất bại.");
    }
  }

  async function handleRecomputeRoute() {
    if (!canEdit || recomputingRoute) return;
    setRecomputingRoute(true);
    try {
      const res = await fetch(tripApiUrl(`/api/trips/${trip.slug}/recompute-route`), { method: "POST" });
      if (res.ok) {
        // Route mode/coords/distance all live in the `trip` prop from the
        // server component above -- simplest correct way to reflect the new
        // road route (colors, dashing, distance stat) is to refetch it.
        window.location.reload();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Tính lại lộ trình thất bại.");
        setRecomputingRoute(false);
      }
    } catch {
      alert("Tính lại lộ trình thất bại.");
      setRecomputingRoute(false);
    }
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    if (!canEdit) return;
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const prev = photos;
    setPhotos(reordered);
    try {
      const res = await fetch(tripApiUrl(`/api/trips/${trip.slug}/reorder`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: reordered.map((p) => p.id) }),
      });
      if (!res.ok) {
        setPhotos(prev);
        alert("Sắp xếp lại ảnh thất bại.");
      }
    } catch {
      setPhotos(prev);
      alert("Sắp xếp lại ảnh thất bại.");
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
  const hasRoute = trip.routeCoords.length >= 2;
  const canPlay = mapReady && !isPlaying && hasRoute;
  // Once playing, the same button toggles pause/resume instead of being
  // disabled -- previously it just showed a spinner for the whole
  // animation with no way to stop and look at something mid-route.
  const playLabel = !mapReady
    ? "Đang tải bản đồ..."
    : isPlaying
      ? isPaused
        ? "Tiếp tục"
        : "Tạm dừng"
      : hasPlayed
        ? "Phát lại"
        : "Phát animation";
  const playIcon = !mapReady ? "hourglass_empty" : isPlaying ? (isPaused ? "play_arrow" : "pause") : hasPlayed ? "replay" : "play_arrow";
  function handlePlayButtonClick() {
    if (!isPlaying) {
      playAnimation();
      return;
    }
    if (isPaused) resumeAnimation();
    else pauseAnimation();
  }

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
          {i < photos.length - 1 && <div className="w-px flex-1 bg-border-glass mt-1" />}
        </div>
        <div className="flex-1 min-w-0 pb-2">
          <img
            src={p.url}
            alt=""
            loading="lazy"
            decoding="async"
            className={`w-full h-24 object-cover rounded-lg border transition-colors ${
              isActive ? "border-primary-container" : "border-border-glass group-hover:border-primary-container/50"
            }`}
          />
          <div className="mt-1.5 flex justify-between items-center">
            <span className={`text-xs ${isActive ? "text-primary" : "text-on-surface-variant"}`}>{fmtTime(p.takenAt)}</span>
            {canEdit && (
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => movePhoto(i, -1)}
                  disabled={i === 0}
                  title="Chuyển lên trước"
                  className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-glass disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_upward</span>
                </button>
                <button
                  onClick={() => movePhoto(i, 1)}
                  disabled={i === photos.length - 1}
                  title="Chuyển xuống sau"
                  className="w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-glass disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_downward</span>
                </button>
              </div>
            )}
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

        @keyframes moto-glow-pulse {
          0%, 100% { box-shadow: 0 0 14px 2px rgba(255,122,69,0.75); }
          50% { box-shadow: 0 0 26px 8px rgba(255,122,69,0.9); }
        }
        .moto-marker-glow { animation: moto-glow-pulse 1.4s ease-in-out infinite; }

        @keyframes chapter-dot-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .chapter-dot-visited { animation: chapter-dot-pop 0.3s ease-out; }
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

          {/* Off-screen -- never shown, only ever read via captureStream() by
              recordAnimationVideoCanvas ("Xuất mượt"). Kept in the DOM (not
              display:none) since some browsers pause canvas updates on
              display:none elements. */}
          <canvas
            ref={captureCanvasRef}
            aria-hidden
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />

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

          {recording && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Đang xuất video...
            </div>
          )}

          {isPlaying && (
            <div className={`absolute left-4 right-4 z-10 ${recording ? "top-32" : "top-20"}`}>
              <div className="h-1 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-container to-gradient-pink transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* Chapter dots: one per photo, marking where along the route it was
                  taken -- fills in as the moving marker passes each one, so the
                  bar reads like a video scrubber with chapters instead of a plain
                  progress fill. */}
              {trip.routeCoords.length > 1 &&
                stops.map((stop) => {
                  const pct = (stop.coordIdx / (trip.routeCoords.length - 1)) * 100;
                  const visited = progressPct >= pct;
                  return (
                    <div
                      key={stop.photo.id}
                      className={`absolute top-1/2 w-2 h-2 rounded-full border transition-colors ${
                        visited ? "chapter-dot-visited bg-primary-container border-white" : "bg-white/30 border-white/40"
                      }`}
                      style={{ left: `${pct}%`, transform: "translate(-50%, -50%)" }}
                    />
                  );
                })}
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
                <div className="relative w-full h-32 rounded-lg overflow-hidden">
                  <motion.img
                    key={stopCard.id}
                    src={stopCard.url}
                    alt=""
                    className="w-full h-full object-cover"
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.08 }}
                    transition={{ duration: 1.5, ease: "linear" }}
                  />
                  <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {stopCardDistanceKm.toFixed(1)} km
                  </span>
                </div>
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

          <AnimatePresence>
            {showComplete && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.96 }}
                transition={{ type: "spring", damping: 22, stiffness: 260 }}
                className="absolute left-1/2 bottom-6 -translate-x-1/2 w-72 glass rounded-2xl p-4 flex flex-col items-center gap-3 z-10 shadow-xl shadow-black/40 text-center"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-container to-gradient-pink flex items-center justify-center">
                  <span className="material-symbols-outlined text-neutral-950 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    flag_circle
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold">Hoàn thành hành trình!</div>
                  <div className="text-xs text-on-surface-variant mt-0.5">
                    {trip.distanceKm.toFixed(1)} km · {fmtDuration(trip.durationMs)} · {trip.photos.length} ảnh
                  </div>
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => setShowComplete(false)}
                    className="flex-1 py-2 rounded-full text-xs font-semibold bg-surface-glass border border-border-glass text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={() => {
                      setShowComplete(false);
                      playAnimation();
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold glow-button text-neutral-950"
                  >
                    <span className="material-symbols-outlined text-sm">replay</span>
                    Xem lại
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* All chrome below is real-visitor-only -- render=1 (see
            renderMode above) is exclusively the render service's headless
            browser capturing frames, and none of this belongs in the
            exported video. */}
        {!renderMode && (
          <aside className="hidden lg:flex flex-col w-80 h-full glass border-l border-border-glass bg-surface-container-low/80 relative z-20">
            <div className="p-4 border-b border-border-glass flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold">Hành trình ảnh</h3>
              <span className="text-xs text-on-surface-variant bg-surface-glass px-2 py-1 rounded">{photos.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">{photos.map(renderPhotoItem)}</div>
          </aside>
        )}

        {/* Mobile-only: the sidebar above is hidden below `lg`, so a floating
            button opens the same photo list as a bottom sheet instead. */}
        {!renderMode && (
          <button
            onClick={() => setMobileSheetOpen(true)}
            className="lg:hidden absolute bottom-4 right-4 z-30 glass w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-black/40"
          >
            <span className="material-symbols-outlined text-primary-container text-2xl">photo_library</span>
            <span className="absolute -top-1 -right-1 bg-gradient-to-br from-primary-container to-gradient-pink text-on-primary-container text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {trip.photos.length}
            </span>
          </button>
        )}

        {!renderMode && (
        <header className="absolute top-4 left-4 right-4 lg:right-[336px] z-30 glass rounded-3xl sm:rounded-full px-4 sm:px-6 py-3 flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-2 transition-all">
          {/* Below `sm` this stacks as its own row instead of sharing a CSS Grid
              row with the controls below -- grid auto-placement skips items
              hidden via `display:none` entirely, so with the desktop play/more
              cluster hidden on phones, the controls row used to get shoved into
              this title's column and crush it down to a sliver. The explicit
              `sm:col-start-*` pins below make the sm+ grid immune to the same
              bug regardless of which column's content happens to be hidden. */}
          <div className="flex items-center gap-1.5 min-w-0 sm:col-start-1">
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

          <div className="hidden md:flex items-center justify-center gap-2 sm:col-start-2">
            <button
              onClick={handlePlayButtonClick}
              disabled={!mapReady || !hasRoute}
              className="glow-button text-neutral-950 text-xs font-bold px-6 py-2 rounded-full flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                {playIcon}
              </span>
              {playLabel}
            </button>
            <button
              data-more-menu
              onClick={() => setMoreMenuOpen((o) => !o)}
              title="Thêm tuỳ chọn"
              className="w-9 h-9 rounded-full bg-surface-glass border border-border-glass flex items-center justify-center text-on-surface-variant hover:text-primary-container transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-lg">more_horiz</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto min-w-0 sm:col-start-3 sm:justify-end">
            <button
              onClick={handlePlayButtonClick}
              disabled={!mapReady || !hasRoute}
              className="md:hidden glow-button text-neutral-950 w-8 h-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                {playIcon}
              </span>
            </button>
            <button
              data-more-menu
              onClick={() => setMoreMenuOpen((o) => !o)}
              title="Thêm tuỳ chọn"
              className="md:hidden w-8 h-8 rounded-full bg-surface-glass border border-border-glass flex items-center justify-center text-on-surface-variant shrink-0"
            >
              <span className="material-symbols-outlined text-lg">more_horiz</span>
            </button>

            {/* Compact single pill for phones (<sm): the full row below hides
                entirely at that width, which used to leave a share link
                opened on a phone -- the most common way this page gets
                viewed -- with no distance/photo count visible at all. */}
            <div className="pill sm:hidden text-on-surface-variant text-xs gap-1.5 whitespace-nowrap">
              <span className="material-symbols-outlined text-sm text-secondary">route</span>
              <b className="text-on-surface font-semibold">{trip.distanceKm.toFixed(1)}km</b>
              <span className="opacity-40">·</span>
              <span className="material-symbols-outlined text-sm text-secondary">photo_library</span>
              {trip.photos.length}
            </div>

            <div className="hidden sm:flex gap-2">
              <div className="pill text-on-surface-variant text-xs gap-1.5 whitespace-nowrap">
                <span className="material-symbols-outlined text-sm text-secondary">route</span>
                <b className="text-on-surface font-semibold">{trip.distanceKm.toFixed(1)} km</b>
                <span className="opacity-70">{trip.routeMode === "road" ? "đường thực" : "đường thẳng"}</span>
                {canEdit && trip.routeMode === "straight" && (
                  <button
                    onClick={handleRecomputeRoute}
                    disabled={recomputingRoute}
                    title="OSRM có thể đã lỗi lúc tạo chuyến -- thử tính lại đường thực"
                    className="ml-0.5 text-secondary hover:text-on-surface transition-colors disabled:opacity-40"
                  >
                    <span className={`material-symbols-outlined text-sm ${recomputingRoute ? "animate-spin" : ""}`}>
                      {recomputingRoute ? "progress_activity" : "autorenew"}
                    </span>
                  </button>
                )}
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

            {/* hidden below sm: on phones these move into the "..." menu instead
                (see the moreMenuOpen panel) -- five separate icon buttons plus
                the stats pill packed into one row left no room for the trip
                title, which is why it used to disappear entirely on mobile. */}
            {canEdit && (
              <button
                onClick={handleTogglePrivacy}
                title={isPublic ? "Đang công khai -- bấm để đặt riêng tư" : "Đang riêng tư -- bấm để công khai"}
                className="hidden sm:flex items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors bg-surface-glass px-3 py-1.5 rounded-full shrink-0 text-xs"
              >
                <span className="material-symbols-outlined text-sm">{isPublic ? "lock_open" : "lock"}</span>
                <span className="hidden md:inline">{isPublic ? "Công khai" : "Riêng tư"}</span>
              </button>
            )}

            {canEdit && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="hidden sm:flex items-center gap-1 text-error hover:text-error-container transition-colors bg-surface-glass px-3 py-1.5 rounded-full ml-1 shrink-0 text-xs"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span className="hidden md:inline">{deleting ? "Đang xoá..." : "Xoá"}</span>
              </button>
            )}
          </div>

          <AnimatePresence>
            {moreMenuOpen && (
              <motion.div
                data-more-menu
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-3 sm:right-4 mt-2 z-40 glass rounded-2xl p-1.5 flex flex-col gap-0.5 w-64 shadow-xl shadow-black/40"
              >
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    exportVideo();
                  }}
                  disabled={!canPlay || recording || isPlaying}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-glass transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                >
                  <span className="material-symbols-outlined text-lg shrink-0">
                    {recording ? "fiber_manual_record" : "videocam"}
                  </span>
                  Xuất nhanh (quay màn hình)
                </button>
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    exportVideoCanvas();
                  }}
                  disabled={!canPlay || recording || isPlaying}
                  title="Không xin quyền chia sẻ màn hình, không bị giật do máy/tab đang bận việc khác"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-glass transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                >
                  <span className="material-symbols-outlined text-lg shrink-0">
                    {recording ? "fiber_manual_record" : "auto_awesome_motion"}
                  </span>
                  Xuất mượt (không quay màn hình)
                </button>
                {renderServiceAvailable && (
                  <button
                    onClick={() => {
                      setMoreMenuOpen(false);
                      exportVideoServer();
                    }}
                    disabled={!canPlay || serverRendering}
                    title="Render trên server, không phụ thuộc máy/mạng của bạn -- chậm hơn nhưng luôn ra kết quả giống nhau"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-glass transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                  >
                    <span className={`material-symbols-outlined text-lg shrink-0 ${serverRendering ? "animate-spin" : ""}`}>
                      {serverRendering ? "progress_activity" : "cloud_done"}
                    </span>
                    {serverRendering ? "Đang xuất trên server..." : "Xuất chuẩn (server)"}
                  </button>
                )}
                {tiktokAvailable &&
                  (tiktokConnected ? (
                    <>
                      <button
                        onClick={() => {
                          setMoreMenuOpen(false);
                          postToTikTok();
                        }}
                        disabled={!canPlay || recording || isPlaying || postingTikTok}
                        title="Đăng lên TikTok -- vào Bản nháp trong app TikTok để hoàn tất"
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-[#ff0050] hover:bg-surface-glass transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                      >
                        {postingTikTok ? (
                          <span className="material-symbols-outlined text-lg shrink-0 animate-spin">progress_activity</span>
                        ) : (
                          <TikTokIcon className="shrink-0" />
                        )}
                        Đăng lên TikTok
                      </button>
                      <button
                        onClick={() => {
                          setMoreMenuOpen(false);
                          disconnectTikTok();
                        }}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-error hover:bg-surface-glass transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-lg shrink-0">link_off</span>
                        Ngắt kết nối TikTok
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setMoreMenuOpen(false);
                        connectTikTok();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-[#ff0050] hover:bg-surface-glass transition-colors text-left"
                    >
                      <TikTokIcon className="shrink-0" />
                      Kết nối TikTok
                    </button>
                  ))}
                {canEdit && (
                  <>
                    <div className="my-1 border-t border-border-glass" />
                    <button
                      onClick={() => {
                        setMoreMenuOpen(false);
                        markerIconInputRef.current?.click();
                      }}
                      disabled={uploadingMarkerIcon}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-glass transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                    >
                      <span className={`material-symbols-outlined text-lg shrink-0 ${uploadingMarkerIcon ? "animate-spin" : ""}`}>
                        {uploadingMarkerIcon ? "progress_activity" : "add_a_photo"}
                      </span>
                      {uploadingMarkerIcon ? "Đang tải ảnh lên..." : "Đổi ảnh xe chạy"}
                    </button>
                    {markerIconIsCustom && (
                      <button
                        onClick={() => {
                          setMoreMenuOpen(false);
                          handleResetMarkerIcon();
                        }}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-glass transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-lg shrink-0">restart_alt</span>
                        Dùng ảnh mặc định
                      </button>
                    )}
                  </>
                )}
                {/* Phone-only mirror of the standalone privacy/delete buttons
                    above (hidden here via sm:hidden since those buttons take
                    over again once there's enough width, at sm+) -- keeps
                    them reachable without crowding the header row. */}
                {canEdit && (
                  <div className="sm:hidden">
                    <div className="my-1 border-t border-border-glass" />
                    <button
                      onClick={() => {
                        setMoreMenuOpen(false);
                        handleTogglePrivacy();
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-glass transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-lg shrink-0">{isPublic ? "lock_open" : "lock"}</span>
                      {isPublic ? "Đang công khai -- đặt riêng tư" : "Đang riêng tư -- đặt công khai"}
                    </button>
                    <button
                      onClick={() => {
                        setMoreMenuOpen(false);
                        handleDelete();
                      }}
                      disabled={deleting}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-error hover:text-error-container hover:bg-surface-glass transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
                    >
                      <span className="material-symbols-outlined text-lg shrink-0">delete</span>
                      {deleting ? "Đang xoá..." : "Xoá chuyến đi"}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </header>
        )}
        {canEdit && (
          <input
            ref={markerIconInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleMarkerIconFileChange}
          />
        )}
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
                <span className="text-xs text-on-surface-variant bg-surface-glass px-2 py-1 rounded">{photos.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">{photos.map(renderPhotoItem)}</div>
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

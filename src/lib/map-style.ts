import { setWorkerUrl, getVersion, type StyleSpecification } from "maplibre-gl";

// MapLibre lazily derives its worker script's URL from import.meta.url of its
// own bundled chunk. Under Next.js/Turbopack that chunk gets inlined into a
// shared bundle with a URL that has no matching /maplibre-gl-worker.mjs next
// to it, so the browser's module-worker fetch 404s (Next.js serves its HTML
// fallback page for that, which is the "non-JavaScript MIME type" error) and
// the worker silently never becomes ready -- the real cause of the map hanging
// forever, unrelated to vector vs. raster tiles. Point it at the exact same
// version hosted on a CDN instead (built from getVersion() so this can't
// drift out of sync with whatever maplibre-gl version actually ships).
//
// Module-level so it only ever runs once no matter how many components
// import this file.
setWorkerUrl(`https://cdn.jsdelivr.net/npm/maplibre-gl@${getVersion()}/dist/maplibre-gl-worker.mjs`);

// Raster tiles, not OpenFreeMap's vector style: MapLibre's vector-tile
// pipeline dispatches parsing to a Web Worker, and in both our own testing
// and on a real user's device that worker reliably never resolved a single
// tile (main-thread fetches to the exact same tile URLs succeeded fine, so
// it isn't the network or a CORS/bundler issue -- something in MapLibre's
// worker/dispatcher path itself hangs). Raster tiles are plain image
// requests handled on the main thread with no such dependency, trading the
// vector style's glow/dash styling for the map actually loading.
export const MAP_STYLE: StyleSpecification = {
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

// Fallback used when the primary Esri source errors or hangs (critique:
// riders on weak rural connections hit this in the field, and the old
// "retry" just recreated the map against the same failing source). CARTO's
// free raster basemap is a different origin/CDN entirely, so a primary
// outage is unlikely to take both down at once. Standard {z}/{x}/{y} order.
export const MAP_STYLE_FALLBACK: StyleSpecification = {
  version: 8,
  sources: {
    "fallback-basemap": {
      type: "raster",
      // CARTO's raster basemaps live under /rastertiles/<style>/... -- a
      // fallback URL missing that path segment 404s (surfaced as an "API
      // KEY REQUIRED" watermark tile instead of a real error), leaving
      // riders stuck on a broken fallback with no visible way to tell why.
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
    },
  },
  layers: [{ id: "fallback-basemap-layer", type: "raster", source: "fallback-basemap" }],
};

// MapLibre paint properties need a literal color string (they can't read a
// CSS custom property), so the glow variants derive from the hex constants
// below instead of retyping the RGB triplet -- keeps this file self-
// consistent even though it can't share --accent-rgb from globals.css.
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Mirrors --accent / --accent-2 in globals.css -- kept as literal hex here
// since MapLibre paint properties can't read a CSS custom property.
export const ACCENT = "#f5a623";
export const ACCENT_GLOW = hexToRgba(ACCENT, 0.6);
export const SECONDARY = "#2dd4bf";
export const SECONDARY_GLOW = hexToRgba(SECONDARY, 0.4);

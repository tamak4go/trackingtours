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

export const ACCENT = "#ff7a45";
export const ACCENT_GLOW = "rgba(255, 122, 69, 0.6)";
export const SECONDARY = "#75d1ff";
export const SECONDARY_GLOW = "rgba(79, 195, 247, 0.4)";

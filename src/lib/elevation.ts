import { haversineKm } from "@/lib/geo";

// Caps how many coordinates get sent to the elevation API -- a road route can
// have hundreds of points, but an elevation *profile* looks the same with far
// fewer samples, and keeps the request small against a free, no-SLA demo
// server (see OSRM_BASE_URL in geo.ts for the same tradeoff on routing).
const MAX_SAMPLES = 120;

// Open-Elevation's public demo instance -- no API key, no guaranteed
// uptime/rate limits. Set NEXT_PUBLIC_ELEVATION_API_URL to a self-hosted or
// paid instance's /lookup endpoint to swap it out with no code changes.
const ELEVATION_API_URL = process.env.NEXT_PUBLIC_ELEVATION_API_URL || "https://api.open-elevation.com/api/v1/lookup";

export function sampleRouteForElevation(coords: [number, number][]): [number, number][] {
  if (coords.length <= MAX_SAMPLES) return coords;
  const stride = (coords.length - 1) / (MAX_SAMPLES - 1);
  return Array.from({ length: MAX_SAMPLES }, (_, i) => coords[Math.round(i * stride)]);
}

export async function fetchElevations(coords: [number, number][]): Promise<number[]> {
  const locations = coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  const res = await fetch(ELEVATION_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locations }),
  });
  if (!res.ok) throw new Error(`Open-Elevation request failed: ${res.status}`);
  const data = await res.json();
  const results = data?.results;
  if (!Array.isArray(results) || results.length !== coords.length) {
    throw new Error("Open-Elevation returned an unexpected shape");
  }
  return results.map((r: { elevation: number }) => r.elevation);
}

export type ElevationProfileData = {
  coords: [number, number][]; // [lng, lat], same order/length as elevations
  elevations: number[]; // meters, same order as coords
  cumulativeKm: number[]; // distance from the route start to each coord
  gainM: number;
  lossM: number;
};

// Raw SRTM-derived samples from a free elevation API are noisy at short
// distances -- a flat road can read as a stairstep of +/-2m between
// consecutive points, which would wildly overstate total gain/loss. A light
// 3-point moving average smooths that out before summing deltas, without
// hiding real climbs/descents.
function smooth(values: number[]): number[] {
  return values.map((v, i) => {
    const prev = values[i - 1] ?? v;
    const next = values[i + 1] ?? v;
    return (prev + v + next) / 3;
  });
}

export function buildElevationProfile(coords: [number, number][], rawElevations: number[]): ElevationProfileData {
  const elevations = smooth(rawElevations);
  const cumulativeKm: number[] = [0];
  let gainM = 0;
  let lossM = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    cumulativeKm.push(cumulativeKm[i - 1] + haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }));
    const delta = elevations[i] - elevations[i - 1];
    if (delta > 0) gainM += delta;
    else lossM += -delta;
  }
  return { coords, elevations, cumulativeKm, gainM, lossM };
}

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type OSRMRoute = {
  distanceKm: number;
  durationS: number;
  coords: [number, number][]; // [lng, lat]
};

// Defaults to the public OSRM demo server -- fine for prototyping, not for
// production volume or a paying user base (no SLA, shared rate limits). Set
// NEXT_PUBLIC_OSRM_BASE_URL to a self-hosted OSRM instance's origin (see
// docs/self-host-osrm.md) to swap it out with no code changes.
const OSRM_BASE_URL = process.env.NEXT_PUBLIC_OSRM_BASE_URL || "https://router.project-osrm.org";

export async function fetchRoadRoute(points: LatLng[]): Promise<OSRMRoute> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`);
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error("OSRM returned no route");
  return {
    distanceKm: route.distance / 1000,
    durationS: route.duration,
    coords: route.geometry.coordinates as [number, number][],
  };
}

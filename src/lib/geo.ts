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

// Public OSRM demo server -- fine for prototyping, not for production volume
// or a paying user base. Swap for a self-hosted OSRM instance or a paid
// routing API (OpenRouteService, Mapbox Directions) before shipping widely.
export async function fetchRoadRoute(points: LatLng[]): Promise<OSRMRoute> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
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

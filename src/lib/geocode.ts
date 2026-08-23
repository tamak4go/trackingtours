// Best-effort reverse geocoding for an auto-generated trip title. Runs
// server-side only (needs a custom User-Agent per Nominatim's usage policy,
// which browser fetch() cannot set) and never blocks trip creation on
// failure -- a slow or unreachable geocoder just means no auto title.
export async function reverseGeocodePlaceName(lat: number, lng: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=vi`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TrackingPhuot/1.0 (personal hobby project)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address ?? {};
    const raw = addr.city || addr.town || addr.county || addr.state || null;
    // Nominatim's Vietnamese names carry the administrative-unit word (Xã,
    // Phường, Huyện, ...) baked in, which reads awkwardly once dropped into
    // "Chuyến đi <name>" -- strip it for a more natural-sounding title.
    return raw ? raw.replace(/^(Xã|Phường|Thị trấn|Huyện|Quận|Thành phố|Tỉnh)\s+/i, "") : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

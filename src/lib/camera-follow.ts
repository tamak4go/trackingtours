// Pure math for the "smart camera" during trip replay (see playAnimation in
// TripView.tsx): the camera should turn to face the direction of travel and
// pull in/tilt on tight mountain-pass curves, then ease back out on long
// straights, instead of just re-centering at a fixed top-down zoom every
// frame. Kept here (not inline in TripView.tsx) so the geometry can be
// tested in isolation -- there's no way to eyeball "is this bearing/zoom
// curve smooth or jittery" from a single screenshot of a live map, but the
// underlying math is fully deterministic and testable on its own.

export type LngLat = [number, number];

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

// Compass bearing from `a` to `b`, in degrees clockwise from north --
// matches MapLibre's own `bearing` convention directly.
export function bearingBetween(a: LngLat, b: LngLat): number {
  const lat1 = a[1] * RAD;
  const lat2 = b[1] * RAD;
  const dLng = (b[0] - a[0]) * RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * DEG + 360) % 360;
}

// Shortest signed angular distance from `a` to `b` in degrees, in
// (-180, 180] -- e.g. angleDiff(350, 10) is 20, not -340. Needed so
// smoothAngle turns the short way around the compass instead of spinning
// almost all the way round when the bearing crosses 0/360.
function angleDiff(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

// Frame-rate-independent exponential smoothing: `halfLifeMs` is how long it
// takes to close half the remaining gap to the target, regardless of how
// choppy `dt` is between calls. This is what makes the camera read the same
// on a live 60fps Play as on the render service's fixed 30fps deterministic
// ticks (see the renderMode effect in TripView.tsx) -- both converge along
// the same curve, just sampled at different rates.
function smoothFactor(dt: number, halfLifeMs: number): number {
  if (halfLifeMs <= 0) return 1;
  return 1 - Math.pow(0.5, dt / halfLifeMs);
}

export function smoothAngle(current: number, target: number, dt: number, halfLifeMs: number): number {
  const factor = smoothFactor(dt, halfLifeMs);
  return (current + angleDiff(current, target) * factor + 360) % 360;
}

export function smoothValue(current: number, target: number, dt: number, halfLifeMs: number): number {
  return current + (target - current) * smoothFactor(dt, halfLifeMs);
}

export type FollowCameraOptions = {
  /** Zoom level on long straights (no look-ahead curvature). */
  baseZoom: number;
  /** Extra zoom added on top of baseZoom at maximum curvature. */
  curveZoomBoost: number;
  /** Camera pitch in degrees at maximum curvature (0 on straights). */
  maxPitch: number;
  /** How many route points ahead to sample when measuring curvature. */
  lookAheadCount: number;
};

export type FollowCameraTarget = {
  bearing: number;
  zoom: number;
  pitch: number;
  /** 0 (straight) .. 1 (as curvy as the model tops out at), exposed for tests/debugging. */
  curvature: number;
};

export const DEFAULT_FOLLOW_CAMERA_OPTIONS: FollowCameraOptions = {
  baseZoom: 13,
  curveZoomBoost: 1.6,
  maxPitch: 50,
  lookAheadCount: 8,
};

// Target (not yet smoothed -- see smoothAngle/smoothValue) camera state for
// `coords` at fractional route index `idx`. Curvature is measured as the
// total heading swing across the look-ahead window: a long straight swings
// ~0 degrees (curvature 0), a hairpin swings up to 180 degrees (curvature 1,
// clamped so a pathological zigzag can't push it past that).
export function computeFollowCameraTarget(
  coords: LngLat[],
  idx: number,
  options: Partial<FollowCameraOptions> = {},
): FollowCameraTarget {
  const opts = { ...DEFAULT_FOLLOW_CAMERA_OPTIONS, ...options };
  if (coords.length < 2) return { bearing: 0, zoom: opts.baseZoom, pitch: 0, curvature: 0 };

  const i0 = Math.max(0, Math.min(coords.length - 1, Math.floor(idx)));
  const iNext = Math.min(i0 + 1, coords.length - 1);
  const bearing = i0 === iNext ? bearingBetween(coords[i0 - 1] ?? coords[i0], coords[i0]) : bearingBetween(coords[i0], coords[iNext]);

  const lookEnd = Math.min(coords.length - 1, i0 + opts.lookAheadCount);
  if (lookEnd <= iNext) {
    // Near the very end of the route -- nothing meaningful ahead to measure
    // curvature from. Hold a flat, straight-on camera rather than guessing.
    return { bearing, zoom: opts.baseZoom, pitch: 0, curvature: 0 };
  }

  let totalSwing = 0;
  let prevBearing = bearing;
  for (let i = iNext; i < lookEnd; i++) {
    const b = bearingBetween(coords[i], coords[i + 1]);
    totalSwing += Math.abs(angleDiff(prevBearing, b));
    prevBearing = b;
  }

  const curvature = Math.min(1, totalSwing / 180);
  return {
    bearing,
    zoom: opts.baseZoom + opts.curveZoomBoost * curvature,
    pitch: opts.maxPitch * curvature,
    curvature,
  };
}

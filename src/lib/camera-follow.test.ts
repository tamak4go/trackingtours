import { describe, expect, it } from "vitest";
import { bearingBetween, computeFollowCameraTarget, smoothAngle, smoothValue, type LngLat } from "@/lib/camera-follow";

describe("bearingBetween", () => {
  it("is ~0 (north) for due-north travel", () => {
    expect(bearingBetween([106, 21], [106, 22])).toBeCloseTo(0, 0);
  });

  it("is ~90 (east) for due-east travel", () => {
    expect(bearingBetween([106, 21], [107, 21])).toBeCloseTo(90, 0);
  });

  it("is ~180 (south) for due-south travel", () => {
    expect(bearingBetween([106, 21], [106, 20])).toBeCloseTo(180, 0);
  });
});

describe("smoothAngle", () => {
  it("turns the short way across the 0/360 wraparound", () => {
    // 350 -> 10 is a 20-degree turn through 0, not a 340-degree turn the long way.
    const next = smoothAngle(350, 10, 1000, 1000);
    // Halfway (dt == halfLife) should land near 350 + 10 = 360 (== 0), well
    // short of swinging all the way down to ~180.
    const distanceFrom350 = Math.min(Math.abs(next - 350), 360 - Math.abs(next - 350));
    expect(distanceFrom350).toBeLessThan(30);
  });

  it("converges to the target given enough time", () => {
    const next = smoothAngle(0, 90, 100_000, 200);
    expect(next).toBeCloseTo(90, 0);
  });

  it("holds still when dt is 0", () => {
    expect(smoothAngle(45, 200, 0, 200)).toBeCloseTo(45, 5);
  });
});

describe("smoothValue", () => {
  it("converges to the target given enough time", () => {
    expect(smoothValue(10, 20, 100_000, 200)).toBeCloseTo(20, 1);
  });

  it("moves partway there after one half-life", () => {
    const next = smoothValue(0, 10, 200, 200);
    expect(next).toBeCloseTo(5, 0);
  });
});

describe("computeFollowCameraTarget", () => {
  // A long straight line due east.
  const straight: LngLat[] = Array.from({ length: 20 }, (_, i) => [106 + i * 0.01, 21]);

  // A sharp hairpin: heads east, then reverses to head west (a switchback
  // like the ones on a mountain pass).
  const hairpin: LngLat[] = [
    [106, 21],
    [106.02, 21],
    [106.04, 21],
    [106.06, 21],
    [106.04, 21.02],
    [106.02, 21.02],
    [106, 21.02],
    [105.98, 21.02],
  ];

  it("reads near-zero curvature and no pitch on a straight road", () => {
    const t = computeFollowCameraTarget(straight, 5);
    expect(t.curvature).toBeLessThan(0.05);
    expect(t.pitch).toBeCloseTo(0, 0);
    expect(t.zoom).toBeCloseTo(13, 1); // default baseZoom, no curve boost
  });

  it("reads high curvature and pulls in zoom/pitch through a hairpin", () => {
    const t = computeFollowCameraTarget(hairpin, 2, { lookAheadCount: 5 });
    expect(t.curvature).toBeGreaterThan(0.5);
    expect(t.pitch).toBeGreaterThan(0);
    expect(t.zoom).toBeGreaterThan(13);
  });

  it("clamps curvature to 1 even for a pathological zigzag", () => {
    const zigzag: LngLat[] = Array.from({ length: 12 }, (_, i) => [106 + (i % 2 === 0 ? 0 : 0.02), 21 + i * 0.01]);
    const t = computeFollowCameraTarget(zigzag, 1, { lookAheadCount: 8 });
    expect(t.curvature).toBeLessThanOrEqual(1);
  });

  it("holds a flat camera near the end of the route instead of guessing", () => {
    const t = computeFollowCameraTarget(straight, straight.length - 1);
    expect(t.curvature).toBe(0);
    expect(t.pitch).toBe(0);
  });

  it("respects custom baseZoom/curveZoomBoost/maxPitch options", () => {
    const t = computeFollowCameraTarget(hairpin, 2, {
      lookAheadCount: 5,
      baseZoom: 10,
      curveZoomBoost: 2,
      maxPitch: 60,
    });
    expect(t.zoom).toBeGreaterThanOrEqual(10);
    expect(t.zoom).toBeLessThanOrEqual(12);
    expect(t.pitch).toBeLessThanOrEqual(60);
  });
});

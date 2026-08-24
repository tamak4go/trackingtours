import { describe, expect, it } from "vitest";
import { haversineKm } from "@/lib/geo";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm({ lat: 21.0285, lng: 105.8542 }, { lat: 21.0285, lng: 105.8542 })).toBe(0);
  });

  it("matches the known great-circle distance between Hanoi and Ho Chi Minh City", () => {
    const hanoi = { lat: 21.0285, lng: 105.8542 };
    const hcmc = { lat: 10.7626, lng: 106.6602 };
    // ~1140-1150 km in a straight line -- allow some tolerance since this is
    // meant to catch a broken formula, not pin an exact reference value.
    expect(haversineKm(hanoi, hcmc)).toBeGreaterThan(1100);
    expect(haversineKm(hanoi, hcmc)).toBeLessThan(1200);
  });

  it("is symmetric", () => {
    const a = { lat: 16.0544, lng: 108.2022 };
    const b = { lat: 11.9404, lng: 108.4583 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});

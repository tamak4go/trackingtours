import { useSyncExternalStore } from "react";

export type SavedTrip = {
  slug: string;
  shareUrl: string;
  editUrl: string;
  distanceKm: number;
  photoCount: number;
  isPublic: boolean;
  createdAt: string;
  photoUrl: string | null;
};

const KEY = "tp_my_trips";
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string {
  return localStorage.getItem(KEY) ?? "[]";
}

function getServerSnapshot(): string {
  return "[]";
}

function parse(raw: string): SavedTrip[] {
  try {
    return JSON.parse(raw) as SavedTrip[];
  } catch {
    return [];
  }
}

// Reactively synced with localStorage (and with other calls to saveMyTrip /
// removeMyTrip in the same tab) via useSyncExternalStore, so components
// re-render on change without ever calling setState from inside an effect.
export function useMyTrips(): SavedTrip[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return parse(raw);
}

export function saveMyTrip(trip: SavedTrip) {
  if (typeof window === "undefined") return;
  const trips = parse(localStorage.getItem(KEY) ?? "[]").filter((t) => t.slug !== trip.slug);
  trips.unshift(trip);
  localStorage.setItem(KEY, JSON.stringify(trips.slice(0, 50)));
  emitChange();
}

export function removeMyTrip(slug: string) {
  if (typeof window === "undefined") return;
  const trips = parse(localStorage.getItem(KEY) ?? "[]").filter((t) => t.slug !== slug);
  localStorage.setItem(KEY, JSON.stringify(trips));
  emitChange();
}

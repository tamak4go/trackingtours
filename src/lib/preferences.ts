import { useSyncExternalStore } from "react";

const DEFAULT_PRIVATE_KEY = "tp_default_private";
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return localStorage.getItem(DEFAULT_PRIVATE_KEY) === "1";
}

function getServerSnapshot(): boolean {
  return false;
}

// A per-browser preference (not per-account -- there's no user_settings
// table) for whether a new trip should start as private in the upload
// form's privacy toggle. useSyncExternalStore (not useState+useEffect) so
// the server/first-hydration render and the real localStorage value can
// differ without a setState-in-effect render cascade -- see useMyTrips in
// my-trips.ts for the same pattern.
export function useDefaultPrivate(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setDefaultPrivate(value: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEFAULT_PRIVATE_KEY, value ? "1" : "0");
  emitChange();
}

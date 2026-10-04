import { useSyncExternalStore } from "react";
import { planTripSync } from "@/lib/api/hos-api";
import { DEMO_TRIP } from "@/lib/hos/mock-data";
import type { TripPlan } from "@/lib/hos/types";

const demoPlan = planTripSync(DEMO_TRIP);
let current: TripPlan = demoPlan;
const listeners = new Set<() => void>();
const STORAGE_KEY = "spotter-hos-current-trip-v1";
let restored = false;

function restoreStoredPlan() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed: unknown = JSON.parse(saved);
    if (
      parsed && typeof parsed === "object" && "id" in parsed && "input" in parsed &&
      "points" in parsed && "events" in parsed && "logs" in parsed
    ) {
      current = parsed as TripPlan;
    }
  } catch {
    // A corrupt browser cache should never prevent the planner from loading.
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

/** Whether a saved driver plan exists. Used to avoid replacing it with the starter trip. */
export function hasStoredTrip() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function setCurrentPlan(p: TripPlan) {
  current = p;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // The in-memory plan still works if browser storage is unavailable.
    }
  }
  listeners.forEach((l) => l());
}

export function useCurrentPlan() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const beforeRestore = current;
      restoreStoredPlan();
      if (current !== beforeRestore) l();
      return () => listeners.delete(l);
    },
    () => current,
    () => demoPlan,
  );
}

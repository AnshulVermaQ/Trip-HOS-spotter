import { useSyncExternalStore } from "react";
import { planTripSync } from "@/lib/api/hos-api";
import { DEMO_TRIP } from "@/lib/hos/mock-data";
import type { TripPlan } from "@/lib/hos/types";

const demoPlan = planTripSync(DEMO_TRIP);
let current: TripPlan = demoPlan;
const listeners = new Set<() => void>();

export function setCurrentPlan(p: TripPlan) {
  current = p;
  listeners.forEach((l) => l());
}

export function useCurrentPlan() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => demoPlan,
  );
}

/**
 * Typed API adapter. When VITE_API_BASE_URL is set, calls the Django backend;
 * otherwise falls back to the local mock planner.
 *
 * Expected backend endpoints (to be implemented in Django):
 *   POST {base}/api/trips/plan/      body: TripInput -> TripPlan
 *   GET  {base}/api/trips/{id}/logs/ -> DailyLog[]
 *   GET  {base}/api/trips/           -> TripHistoryItem[]
 */
import { planTripLocal } from "@/lib/hos/engine";
import { MOCK_HISTORY, geocode } from "@/lib/hos/mock-data";
import type { DailyLog, TripHistoryItem, TripInput, TripPlan } from "@/lib/hos/types";

const BASE = (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "");

export class ApiError extends Error {}
export const hasRemoteApi = Boolean(BASE);

function localIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

const planCache = new Map<string, TripPlan>();

export function planTripSync(input: TripInput): TripPlan {
  const current = geocode(input.currentLocation);
  const pickup = geocode(input.pickupLocation);
  const dropoff = geocode(input.dropoffLocation);
  if (!current || !pickup || !dropoff) throw new ApiError("One or more locations could not be found.");
  const plan = planTripLocal(input, { current, pickup, dropoff });
  planCache.set(plan.id, plan);
  return plan;
}

export async function planTrip(input: TripInput): Promise<TripPlan> {
  if (BASE) return http<TripPlan>("/api/trips/plan/", { method: "POST", body: JSON.stringify({ ...input, startDate: localIsoDate() }) });
  await new Promise((r) => setTimeout(r, 450)); // simulate latency
  return planTripSync(input);
}

export async function saveTrip(plan: TripPlan): Promise<TripPlan> {
  if (!BASE) {
    planCache.set(plan.id, plan);
    return plan;
  }
  return http<TripPlan>(`/api/trips/${plan.id}/`, { method: "PUT", body: JSON.stringify(plan) });
}

export async function getTripLogs(tripId: string): Promise<DailyLog[]> {
  if (BASE) return http<DailyLog[]>(`/api/trips/${tripId}/logs/`);
  const plan = planCache.get(tripId);
  if (!plan) throw new ApiError("Trip not found");
  return plan.logs;
}

export async function getTripHistory(): Promise<TripHistoryItem[]> {
  if (BASE) return http<TripHistoryItem[]>("/api/trips/");
  return MOCK_HISTORY;
}

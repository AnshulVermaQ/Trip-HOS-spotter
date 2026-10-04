import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { hasRemoteApi, planTrip } from "@/lib/api/hos-api";
import { DEMO_TRIP } from "@/lib/hos/mock-data";
import type { TripInput } from "@/lib/hos/types";
import { hasStoredTrip, setCurrentPlan, useCurrentPlan } from "@/lib/trip-store";
import { TripPlannerForm } from "@/components/hos/TripPlannerForm";
import { RouteMap } from "@/components/hos/RouteMap";
import { TripSummary } from "@/components/hos/TripSummary";
import { HOSAlerts } from "@/components/hos/HOSAlerts";
import { StopTimeline } from "@/components/hos/StopTimeline";
import { DailyLogTabs } from "@/components/hos/DailyLogTabs";
import { ModelAssumptions } from "@/components/hos/ModelAssumptions";
import { RouteDirections } from "@/components/hos/RouteDirections";
import { Disclaimer } from "@/components/hos/TopNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trip Planner — Spotter HOS Planner" },
      { name: "description", content: "Plan truck trips with Hours of Service breaks, rests and auto-generated ELD daily log sheets." },
      { property: "og:title", content: "Trip Planner — Spotter HOS Planner" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Plan truck trips with HOS breaks, rests and ELD daily log sheets." },
    ],
  }),
  component: Index,
});

function Index() {
  const plan = useCurrentPlan();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didLoadDefault = useRef(false);

  const onSubmit = async (input: TripInput) => {
    setLoading(true);
    setError(null);
    try {
      setCurrentPlan(await planTrip(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not plan trip.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasRemoteApi || didLoadDefault.current || hasStoredTrip()) return;
    didLoadDefault.current = true;
    void onSubmit(DEMO_TRIP);
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Trip Planner</h1>
          <p className="mt-1 text-muted-foreground">Property-carrying · rolling 70-hr / 8-day cycle · driver-selected planning speed</p>
        </div>
        <Disclaimer />
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <TripPlannerForm initial={plan.input} loading={loading} onSubmit={onSubmit} />
          <ModelAssumptions plan={plan} />
          {error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-destructive">{error}</p>}
        </div>
        <div className={loading ? "space-y-6 opacity-60 transition" : "space-y-6 transition"}>
          <RouteMap plan={plan} />
          <RouteDirections plan={plan} />
          <HOSAlerts plan={plan} />
          <TripSummary plan={plan} />
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[380px_minmax(0,1fr)]">
        <StopTimeline plan={plan} />
        <DailyLogTabs plan={plan} />
      </div>
    </main>
  );
}

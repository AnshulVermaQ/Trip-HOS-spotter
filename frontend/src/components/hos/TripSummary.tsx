import { ClipboardList } from "lucide-react";
import { fmtDuration } from "@/lib/hos/engine";
import type { TripPlan } from "@/lib/hos/types";
import { Card, CardHeader } from "./ui";

export function TripSummary({ plan }: { plan: TripPlan }) {
  const cycleUsedAfter = 70 * 60 - plan.cycleRemainingMinutes;
  const stats = [
    { label: "Route distance", value: `${Math.round(plan.totalMiles).toLocaleString()} mi`, sub: `${Math.round(plan.legMiles.toPickup)} + ${Math.round(plan.legMiles.toDropoff)} mi` },
    { label: "Est. driving time", value: fmtDuration(plan.drivingMinutes), sub: "@ 55 mph average" },
    { label: "Total trip time", value: fmtDuration(plan.tripMinutes), sub: `${plan.logs.length} log days` },
    { label: "On-duty (not driving)", value: fmtDuration(plan.onDutyMinutes), sub: `incl. ${fmtDuration(plan.handlingMinutes)} pickup/dropoff` },
    { label: "Breaks / Fuel stops", value: `${plan.counts.breaks} / ${plan.counts.fuel}`, sub: "fuel stops count as breaks" },
    { label: "Overnight rests", value: String(plan.counts.rests + plan.counts.restarts), sub: plan.counts.restarts ? `${plan.counts.restarts} × 34-hr restart` : "10-hr resets" },
  ];
  return (
    <Card>
      <CardHeader icon={<ClipboardList className="size-4" />} title="Trip Summary" />
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-card px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="tabular mt-1 text-xl font-semibold tracking-tight">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-4">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium">70-hr cycle after delivery</span>
          <span className="tabular text-muted-foreground">
            <strong className="text-foreground">{fmtDuration(plan.cycleRemainingMinutes)}</strong> remaining
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <div className="bg-duty-off" style={{ width: `${(plan.counts.restarts ? 0 : plan.input.cycleUsedHours / 70) * 100}%` }} />
          <div className="bg-primary" style={{ width: `${((cycleUsedAfter / 60 - (plan.counts.restarts ? 0 : plan.input.cycleUsedHours)) / 70) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Grey: entered baseline ({plan.input.cycleUsedHours} h){plan.counts.restarts ? " — cleared by restart" : ""} · Navy: this trip's on-duty time.
        </p>
      </div>
    </Card>
  );
}

import { MapPin, Route as RouteIcon } from "lucide-react";
import { fmtDuration } from "@/lib/hos/engine";
import type { EventKind, TripPlan } from "@/lib/hos/types";
import { Card, CardHeader } from "./ui";

const scheduledStopReason: Record<"fuel" | "break" | "rest" | "restart", string> = {
  fuel: "Fuel interval / qualifying break",
  break: "30-minute driving break",
  rest: "10-hour qualifying reset",
  restart: "34-hour cycle restart",
};

function drivingMinutesFor(plan: TripPlan, destination: string) {
  return plan.events
    .filter((event) => event.kind === "drive" && event.note === `Driving toward ${destination}`)
    .reduce((total, event) => total + event.end - event.start, 0);
}

export function RouteDirections({ plan }: { plan: TripPlan }) {
  const { current, pickup, dropoff } = plan.points;
  const legs = [
    { from: current.name, to: pickup.name, miles: plan.legMiles.toPickup, minutes: drivingMinutesFor(plan, pickup.name) },
    { from: pickup.name, to: dropoff.name, miles: plan.legMiles.toDropoff, minutes: drivingMinutesFor(plan, dropoff.name) },
  ];
  const stops = plan.events.filter((event): event is typeof event & { kind: "fuel" | "break" | "rest" | "restart" } =>
    ["fuel", "break", "rest", "restart"].includes(event.kind as EventKind),
  );

  return (
    <Card>
      <CardHeader icon={<RouteIcon className="size-4" />} title="Route directions" subtitle="Planned legs and required scheduled stops" />
      <div className="divide-y divide-border">
        <ol className="px-5 py-1">
          {legs.map((leg, index) => (
            <li key={leg.to} className="grid grid-cols-[28px_1fr] gap-3 py-3">
              <span className="grid size-7 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary">{index + 1}</span>
              <div>
                <p className="text-sm font-semibold">{leg.from} <span className="text-muted-foreground">→</span> {leg.to}</p>
                <p className="tabular mt-0.5 text-sm text-muted-foreground">{Math.round(leg.miles).toLocaleString()} mi · modeled {fmtDuration(leg.minutes)} driving</p>
              </div>
            </li>
          ))}
        </ol>
        <section className="px-5 py-4" aria-label="Scheduled stops">
          <h3 className="text-sm font-semibold">Scheduled stops</h3>
          {stops.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {stops.map((stop) => (
                <li key={stop.id} className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span><strong>{stop.location.name}</strong><span className="text-muted-foreground"> — {scheduledStopReason[stop.kind]}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No fuel, break, or overnight-rest stop is required for this route.</p>
          )}
        </section>
      </div>
    </Card>
  );
}

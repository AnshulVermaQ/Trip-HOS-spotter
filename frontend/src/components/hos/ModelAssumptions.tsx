import { BadgeInfo } from "lucide-react";
import { Card, CardHeader } from "./ui";
import type { TripPlan } from "@/lib/hos/types";

export function ModelAssumptions({ plan }: { plan: TripPlan }) {
  const assumptions = [
  ["Operation", "Property-carrying · 70 hr / 8 days"],
  ["Driving model", `${plan.input.averageSpeedMph ?? 55} mph driver-selected average`],
  ["Duty handling", "1 hour at pickup and dropoff"],
  ["Fuel planning", "At least every 1,000 route miles"],
  ["Road routing", "OSRM / OpenStreetMap when a trip is planned"],
  ];
  return (
    <Card>
      <CardHeader icon={<BadgeInfo className="size-4" />} title="Planning assumptions" subtitle="How this schedule is modeled" />
      <dl className="divide-y divide-border px-5 py-2">
        {assumptions.map(([term, description]) => (
          <div key={term} className="grid gap-0.5 py-2.5 text-sm sm:grid-cols-[116px_1fr] sm:gap-3">
            <dt className="font-medium text-foreground">{term}</dt>
            <dd className="text-muted-foreground">{description}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Planning aid only. Enter the driver&apos;s actual eight-day duty history before using a schedule operationally.
      </p>
    </Card>
  );
}

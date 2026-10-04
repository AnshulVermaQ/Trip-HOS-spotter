import { Clock } from "lucide-react";
import { eventDay, fmtClock, fmtDuration } from "@/lib/hos/engine";
import { DUTY_LABELS, type EventKind, type TripPlan } from "@/lib/hos/types";
import { Card, CardHeader, kindColor, kindLabel } from "./ui";
import { cn } from "@/lib/utils";

const stopReason: Partial<Record<EventKind, string>> = {
  pickup: "Required pickup handling time",
  dropoff: "Required dropoff handling time",
  fuel: "Fuel interval reached; also qualifies as a 30-minute interruption",
  break: "8 cumulative driving hours reached",
  rest: "10-hour qualifying reset required before more driving",
  restart: "70-hour / 8-day cycle limit reached",
};

export function StopTimeline({ plan }: { plan: TripPlan }) {
  const events = plan.events.filter((e) => e.kind !== "prior" && e.kind !== "end");
  return (
    <Card>
      <CardHeader icon={<Clock className="size-4" />} title="Planned Timeline" subtitle={`${events.length} duty-status events`} />
      <ol className="max-h-[640px] overflow-y-auto px-5 py-4">
        {events.map((e, i) => {
          const major = e.kind !== "drive";
          return (
            <li key={e.id} className="relative flex gap-4 pb-4 last:pb-0">
              {i < events.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-border" aria-hidden />}
              <span className={cn("relative mt-1.5 size-[15px] shrink-0 rounded-full ring-4 ring-card", kindColor[e.kind])} aria-hidden />
              <div className={cn("flex-1 rounded-lg border px-4 py-3", major ? "border-border bg-card" : "border-transparent bg-muted")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {kindLabel[e.kind]}
                    {e.miles ? <span className="tabular ml-2 font-normal text-muted-foreground">{Math.round(e.miles)} mi</span> : null}
                  </p>
                  <p className="tabular text-xs text-muted-foreground">
                    Day {eventDay(e.start)} · {fmtClock(e.start % 1440)}–{fmtClock(e.end % 1440)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">{e.location.name}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-secondary px-2 py-0.5 font-medium">{DUTY_LABELS[e.status]}</span>
                  <span className="tabular rounded-md bg-secondary px-2 py-0.5">{fmtDuration(e.end - e.start)}</span>
                  {stopReason[e.kind] ? (
                    <span className="text-muted-foreground"><strong className="font-medium text-foreground">Why this stop:</strong> {stopReason[e.kind]}</span>
                  ) : (
                    <span className="text-muted-foreground">{e.note}</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

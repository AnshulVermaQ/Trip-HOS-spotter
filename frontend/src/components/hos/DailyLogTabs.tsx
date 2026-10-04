import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { fmtDate } from "@/lib/hos/engine";
import type { TripPlan } from "@/lib/hos/types";
import { Card, CardHeader } from "./ui";
import { EldLogSheet } from "./EldLogSheet";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DailyLogTabs({ plan }: { plan: TripPlan }) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [plan.id]);
  const log = plan.logs[Math.min(active, plan.logs.length - 1)]!;

  return (
    <Card className="min-w-0">
      <CardHeader icon={<FileText className="size-4" />} title="ELD Daily Logs" subtitle={`${plan.logs.length} log sheets · each totals 24 hours`} />
      <div role="tablist" aria-label="Daily logs" className="no-print flex gap-2 overflow-x-auto border-b border-border px-5 py-3">
        {plan.logs.map((l, i) => (
          <Button
            key={l.day}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setActive((a) => Math.min(plan.logs.length - 1, a + 1));
              if (e.key === "ArrowLeft") setActive((a) => Math.max(0, a - 1));
            }}
            variant="outline"
            className={cn(
              "shrink-0 rounded-lg border px-4 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              i === active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary",
            )}
          >
            <span className="block text-sm font-semibold">Day {l.day}</span>
            <span className={cn("tabular block text-xs", i === active ? "text-primary-foreground/75" : "text-muted-foreground")}>
              {fmtDate(l.date)} · {Math.round(l.miles)} mi
            </span>
          </Button>
        ))}
      </div>
      <div role="tabpanel" className="p-4 sm:p-5">
        <EldLogSheet plan={plan} log={log} />
      </div>
    </Card>
  );
}

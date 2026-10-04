import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { HosWarning, TripPlan } from "@/lib/hos/types";
import { cn } from "@/lib/utils";

const style = {
  ok: { icon: CheckCircle2, box: "bg-success-soft border-success/30", ic: "text-success" },
  info: { icon: Info, box: "bg-info-soft border-primary/15", ic: "text-primary" },
  warning: { icon: AlertTriangle, box: "bg-warning-soft border-warning/40", ic: "text-warning" },
  critical: { icon: AlertOctagon, box: "bg-danger-soft border-destructive/40", ic: "text-destructive" },
};

export function HOSAlerts({ plan }: { plan: TripPlan }) {
  const hasIssue = plan.warnings.some((w) => w.level === "warning" || w.level === "critical");
  const list: HosWarning[] = hasIssue
    ? plan.warnings
    : [
        { level: "ok", title: "Plan is within modeled limits", message: "11-hr driving, 14-hr window, 30-min break, 10-hr reset and 70-hr cycle rules are satisfied." },
        ...plan.warnings,
      ];
  return (
    <div className="space-y-2" aria-live="polite">
      {list.map((w) => {
        const s = style[w.level];
        const I = s.icon;
        return (
          <div key={w.title} role={w.level === "critical" ? "alert" : undefined} className={cn("flex gap-3 rounded-xl border px-4 py-3", s.box)}>
            <I className={cn("mt-0.5 size-5 shrink-0", s.ic)} aria-hidden />
            <div>
              <p className="text-sm font-semibold">{w.title}</p>
              <p className="text-sm text-muted-foreground">{w.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

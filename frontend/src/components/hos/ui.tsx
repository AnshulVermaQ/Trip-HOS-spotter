import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DutyStatus, EventKind } from "@/lib/hos/types";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-secondary text-primary">{icon}</span>
        )}
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

export const dutyColor: Record<DutyStatus, string> = {
  OFF: "bg-duty-off",
  SB: "bg-duty-sb",
  D: "bg-duty-d",
  ON: "bg-duty-on",
};

export const kindColor: Record<EventKind, string> = {
  prior: "bg-duty-off",
  end: "bg-duty-off",
  drive: "bg-duty-d",
  pickup: "bg-marker-pickup",
  dropoff: "bg-marker-dropoff",
  fuel: "bg-marker-stop",
  break: "bg-marker-stop",
  rest: "bg-marker-rest",
  restart: "bg-marker-rest",
};

export const kindLabel: Record<EventKind, string> = {
  prior: "Off Duty",
  end: "Off Duty",
  drive: "Driving",
  pickup: "Pickup",
  dropoff: "Dropoff",
  fuel: "Fuel Stop",
  break: "30-Minute Break",
  rest: "Overnight Rest",
  restart: "34-hr Restart",
};

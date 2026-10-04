import { useState } from "react";
import { Printer, Pencil } from "lucide-react";
import { fmtClock, fmtDate, fmtHours } from "@/lib/hos/engine";
import { DUTY_LABELS, DUTY_ORDER, type DailyLog, type TripPlan } from "@/lib/hos/types";
import { DutyStatusGraph } from "./DutyStatusGraph";
import { dutyColor } from "./ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EditLog, getDriverDetails } from "./EditLog";

function recapForDay(plan: TripPlan, log: DailyLog) {
  const history = (plan.input.cycleHistoryHours?.length === 8
    ? [...plan.input.cycleHistoryHours]
    : [0, 0, 0, 0, 0, 0, 0, plan.input.cycleUsedHours]).map((hours) => hours * 60);
  for (let day = 1; day <= log.day; day += 1) {
    if (day > 1) history.splice(0, 1), history.push(0);
    for (const event of plan.events) {
      const dayStart = (day - 1) * 1440;
      const dayEnd = day * 1440;
      const start = Math.max(event.start, dayStart);
      const end = Math.min(event.end, dayEnd);
      if (end <= start) continue;
      if (event.kind === "restart" && end >= event.end) history.fill(0);
      if (event.status === "D" || event.status === "ON") history[7] += end - start;
    }
  }
  const onDutyToday = log.totals.D + log.totals.ON;
  const cycle = history.reduce((total, minutes) => total + minutes, 0);
  return {
    onDutyToday,
    cycleTotal: Math.min(cycle, 70 * 60),
    availableTomorrow: Math.max(0, 70 * 60 - cycle),
  };
}

function printDailyLog(event: React.MouseEvent<HTMLButtonElement>) {
  const sheet = event.currentTarget.closest("article");
  if (!sheet) return;
  const root = document.createElement("div");
  root.id = "print-root";
  root.appendChild(sheet.cloneNode(true));
  document.body.appendChild(root);
  const cleanup = () => { root.remove(); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  // Some browsers do not dispatch afterprint when the print dialog is cancelled.
  window.setTimeout(cleanup, 120000);
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("border-b border-log-ink/40 pb-1", className)}>
      <p className="font-mono text-sm text-log-ink">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

export function EldLogSheet({ plan, log }: { plan: TripPlan; log: DailyLog }) {
  const [editing, setEditing] = useState(false);
  const details = getDriverDetails(plan);
  const total = Object.values(log.totals).reduce((a, b) => a + b, 0);
  const valid = Math.abs(total - 1440) < 0.5;
  const [y, m, d] = log.date.split("-");
  const recap = recapForDay(plan, log);
  const cumulativeMiles = plan.logs.slice(0, log.day).reduce((totalMiles, dailyLog) => totalMiles + dailyLog.miles, 0);

  return (
    <article className="eld-log-sheet rounded-xl border-2 border-log-ink/70 bg-card p-5 sm:p-6">
      <header className="eld-log-header flex flex-wrap items-start justify-between gap-4 border-b-2 border-log-ink/70 pb-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-log-ink">Driver's Daily Log</h3>
          <p className="text-xs text-muted-foreground">(24 hours) · Original — file at home terminal</p>
        </div>
        <div className="flex items-end gap-3 font-mono text-log-ink">
          {[["month", m], ["day", d], ["year", y]].map(([l, v]) => (
            <div key={l} className="text-center">
              <p className="min-w-12 border-b border-log-ink/50 px-2 text-base font-semibold">{v}</p>
              <p className="text-[10px] uppercase text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
        <div className="no-print flex gap-2">
          <Button type="button" variant="outline" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            <Pencil className="size-4" /> Edit Log
          </Button>
          <Button type="button" variant="outline" onClick={printDailyLog}>
            <Printer className="size-4" /> Print Log
          </Button>
        </div>
      </header>

      <div className="eld-log-fields mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="From" value={log.day === 1 ? plan.points.current.name : log.remarks[0]?.location ?? "—"} />
        <Field label="To" value={plan.points.dropoff.name} />
        <Field label="Total miles driving today" value={`${Math.round(log.miles)} mi`} />
        <Field label="Total mileage today" value={`${Math.round(cumulativeMiles)} mi`} />
        <Field label="Truck / trailer numbers" value={`${details.truck} / ${details.trailer}`} />
        <Field label="Name of carrier" value={details.carrier} />
        <Field label="Main office address" value={details.carrierAddress} />
        <Field label="Driver name" value={details.driverName} />
        <Field label="Driver signature / certification" value={details.driverSignature} />
        <Field label="Co-driver" value={details.coDriver} />
        <Field label="Home terminal / time base" value={details.homeTerminal} />
        <Field label="Pickup" value={plan.points.pickup.name} />
        <Field label="Shipping document" value={details.shippingDoc} />
        <Field label="Shipper and commodity" value={details.shipperCommodity} />
      </div>

      <div className="eld-log-graph mt-5">
        <DutyStatusGraph log={log} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {DUTY_ORDER.map((s) => (
          <span key={s} className="tabular flex items-center gap-2">
            <span className={cn("size-2.5 rounded-sm", dutyColor[s])} />
            {DUTY_LABELS[s]} <strong>{fmtHours(log.totals[s])}</strong>
          </span>
        ))}
        <span className={cn("tabular ml-auto rounded-md px-2 py-0.5 text-xs font-semibold", valid ? "bg-success-soft text-success" : "bg-danger-soft text-destructive")}>
          Total {fmtHours(total)} h {valid ? "✓" : "≠ 24"}
        </span>
      </div>

      <section className="eld-log-recap mt-4 border-y border-log-ink/50 py-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-log-ink">Recap · complete at end of day</h4>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Field label="A · On-duty hours today" value={`${fmtHours(recap.onDutyToday)} h`} />
          <Field label="B · 70-hr cycle total incl. today" value={`${fmtHours(recap.cycleTotal)} h`} />
          <Field label="C · Hours available tomorrow" value={`${fmtHours(recap.availableTomorrow)} h`} />
        </div>
      </section>

      <section className="eld-log-remarks mt-5">
        <h4 className="border-b-2 border-log-ink/70 pb-1 text-sm font-bold uppercase tracking-wide text-log-ink">Remarks</h4>
        <ul className="divide-y divide-border">
          {log.remarks.map((r, i) => (
            <li key={i} className="grid grid-cols-[56px_1fr] gap-3 py-2 text-sm sm:grid-cols-[56px_170px_1fr]">
              <span className="tabular font-mono font-semibold text-log-ink">{fmtClock(r.time)}</span>
              <span className="font-medium">{r.location}</span>
              <span className="col-span-2 text-muted-foreground sm:col-span-1">
                {DUTY_LABELS[r.status]} — {r.note}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-4 text-xs text-muted-foreground">Log date: {fmtDate(log.date, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      {editing && <EditLog plan={plan} day={log.day} onClose={() => setEditing(false)} />}
    </article>
  );
}

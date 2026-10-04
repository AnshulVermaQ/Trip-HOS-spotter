import { useState } from "react";
import { Loader2, Gauge, Route as RouteIcon } from "lucide-react";
import { geocode } from "@/lib/hos/mock-data";
import type { TripInput } from "@/lib/hos/types";
import { Card, CardHeader } from "./ui";
import { cn } from "@/lib/utils";
import { LocationPicker } from "./LocationPicker";
import { Button } from "@/components/ui/button";

type Errors = { [K in keyof TripInput]?: string | undefined };

function validate(v: { currentLocation: string; pickupLocation: string; dropoffLocation: string; cycle: string }): Errors {
  const e: Errors = {};
  const loc = (val: string, label: string) =>
    !val.trim() ? `${label} is required.` : !geocode(val) ? "Choose a US city or town from the list." : undefined;
  e.currentLocation = loc(v.currentLocation, "Current location");
  e.pickupLocation = loc(v.pickupLocation, "Pickup location");
  e.dropoffLocation = loc(v.dropoffLocation, "Dropoff location");
  const n = Number(v.cycle);
  if (v.cycle.trim() === "" || Number.isNaN(n)) e.cycleUsedHours = "Enter hours used (0–70).";
  else if (n < 0 || n > 70) e.cycleUsedHours = "Cycle used must be between 0 and 70 hours.";
  (Object.keys(e) as (keyof TripInput)[]).forEach((k) => e[k] === undefined && delete e[k]);
  return e;
}

export function TripPlannerForm({
  initial,
  loading,
  onSubmit,
}: {
  initial: TripInput;
  loading: boolean;
  onSubmit: (input: TripInput) => void;
}) {
  const [v, setV] = useState({
    currentLocation: initial.currentLocation,
    pickupLocation: initial.pickupLocation,
    dropoffLocation: initial.dropoffLocation,
    cycle: String(initial.cycleUsedHours),
  });
  const [errors, setErrors] = useState<Errors>({});

  const cycleNum = Math.min(70, Math.max(0, Number(v.cycle) || 0));
  const pct = (cycleNum / 70) * 100;

  const submit = (vals = v) => {
    const e = validate(vals);
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({
      currentLocation: geocode(vals.currentLocation)!.name,
      pickupLocation: geocode(vals.pickupLocation)!.name,
      dropoffLocation: geocode(vals.dropoffLocation)!.name,
      cycleUsedHours: Number(vals.cycle),
    });
  };

  const fields = [
    { key: "currentLocation", label: "Current location" },
    { key: "pickupLocation", label: "Pickup location" },
    { key: "dropoffLocation", label: "Dropoff location" },
  ] as const;

  return (
    <Card>
      <CardHeader icon={<RouteIcon className="size-4" />} title="Plan a Trip" subtitle="Enter your route and current cycle hours" />
      <form
        className="space-y-5 p-5"
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
        {fields.map(({ key, label }) => <LocationPicker key={key} id={key} label={label} value={v[key]} onChange={(value) => setV((prev) => ({ ...prev, [key]: value }))} error={errors[key]} />)}

        <div className="space-y-1.5">
          <label htmlFor="cycle" className="text-sm font-medium">
            Current cycle used
          </label>
          <div className="relative">
            <Gauge className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="cycle"
              type="number"
              inputMode="decimal"
              min={0}
              max={70}
              step={0.25}
              value={v.cycle}
              onChange={(e) => setV({ ...v, cycle: e.target.value })}
              aria-invalid={!!errors.cycleUsedHours}
              aria-describedby="cycle-help"
              className={cn(
                "tabular h-11 w-full rounded-lg border bg-card pl-9 pr-16 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                errors.cycleUsedHours ? "border-destructive" : "border-input",
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">hrs</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={70}
            aria-valuenow={cycleNum}
            aria-label="Cycle hours used"
          >
            <div
              className={cn("h-full rounded-full transition-all", pct > 85 ? "bg-destructive" : pct > 60 ? "bg-accent" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p id="cycle-help" className="tabular flex justify-between text-xs text-muted-foreground">
            <span>{cycleNum.toFixed(2)} hours used of 70</span>
            <span>{(70 - cycleNum).toFixed(2)} h available</span>
          </p>
          {errors.cycleUsedHours && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {errors.cycleUsedHours}
            </p>
          )}
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            disabled={loading}
            className="h-11 flex-1"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RouteIcon className="size-4" />}
            Plan Trip
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">US location data: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">GeoNames</a>.</p>
      </form>
    </Card>
  );
}

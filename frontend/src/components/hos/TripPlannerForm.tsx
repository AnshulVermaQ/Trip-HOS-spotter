import { useState } from "react";
import { Loader2, Route as RouteIcon } from "lucide-react";
import { geocode, isUnsupportedRoadLocation } from "@/lib/hos/mock-data";
import type { TripInput } from "@/lib/hos/types";
import { Card, CardHeader } from "./ui";
import { cn } from "@/lib/utils";
import { LocationPicker } from "./LocationPicker";
import { Button } from "@/components/ui/button";

type Errors = { [K in keyof TripInput]?: string | undefined };

function validate(v: { currentLocation: string; pickupLocation: string; dropoffLocation: string; history: string[]; startTime: string; speed: string }): Errors {
  const e: Errors = {};
  const loc = (val: string, label: string) =>
    !val.trim() ? `${label} is required.` : !geocode(val) ? "Choose a road-connected US city or town from the list." : isUnsupportedRoadLocation(val) ? "Alaska and Hawaii are not supported because this planner models contiguous-US road routes only." : undefined;
  e.currentLocation = loc(v.currentLocation, "Current location");
  e.pickupLocation = loc(v.pickupLocation, "Pickup location");
  e.dropoffLocation = loc(v.dropoffLocation, "Dropoff location");
  const history = v.history.map(Number);
  if (history.some((hours, index) => v.history[index]!.trim() === "" || !Number.isFinite(hours) || hours < 0 || hours > 24)) {
    e.cycleHistoryHours = "Enter 0–24 on-duty hours for each of the last 8 days.";
  } else if (history.reduce((total, hours) => total + hours, 0) > 70) {
    e.cycleHistoryHours = "The rolling 8-day on-duty total cannot exceed 70 hours.";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.startTime)) e.startTime = "Use a 24-hour time, for example 06:00.";
  const speed = Number(v.speed);
  if (!Number.isFinite(speed) || speed < 35 || speed > 75) e.averageSpeedMph = "Choose an average speed between 35 and 75 mph.";
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
    history: (initial.cycleHistoryHours?.length === 8 ? initial.cycleHistoryHours : [0, 0, 0, 0, 0, 0, 0, initial.cycleUsedHours]).map(String),
    startTime: initial.startTime ?? "06:00",
    speed: String(initial.averageSpeedMph ?? 55),
  });
  const [errors, setErrors] = useState<Errors>({});

  const cycleNum = Math.min(70, Math.max(0, v.history.reduce((total, value) => total + (Number(value) || 0), 0)));
  const pct = (cycleNum / 70) * 100;

  const submit = (vals = v) => {
    const e = validate(vals);
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({
      currentLocation: geocode(vals.currentLocation)!.name,
      pickupLocation: geocode(vals.pickupLocation)!.name,
      dropoffLocation: geocode(vals.dropoffLocation)!.name,
      cycleUsedHours: vals.history.reduce((total, value) => total + Number(value), 0),
      cycleHistoryHours: vals.history.map(Number),
      startTime: vals.startTime,
      averageSpeedMph: Number(vals.speed),
    });
  };

  const fields = [
    { key: "currentLocation", label: "Current location" },
    { key: "pickupLocation", label: "Pickup location" },
    { key: "dropoffLocation", label: "Dropoff location" },
  ] as const;

  return (
    <Card>
      <CardHeader icon={<RouteIcon className="size-4" />} title="Plan a Trip" subtitle="Enter your route, 8-day duty history, and start time" />
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
          <label className="text-sm font-medium">Rolling 8-day on-duty history</label>
          <div className="grid grid-cols-4 gap-2" aria-describedby="cycle-help">
            {v.history.map((hours, index) => (
              <label key={index} className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {index === 7 ? "Today" : `Day −${7 - index}`}
                <input
                  aria-label={`On-duty hours for ${index === 7 ? "today" : `day minus ${7 - index}`}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={24}
                  step={0.25}
                  value={hours}
                  onChange={(e) => setV((previous) => ({ ...previous, history: previous.history.map((value, position) => position === index ? e.target.value : value) }))}
                  className={cn("tabular h-10 w-full rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", errors.cycleHistoryHours ? "border-destructive" : "border-input")}
                />
              </label>
            ))}
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
          {errors.cycleHistoryHours && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {errors.cycleHistoryHours}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">
            Start time
            <input type="time" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })} className={cn("h-11 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", errors.startTime ? "border-destructive" : "border-input")} />
            {errors.startTime && <span role="alert" className="block text-xs font-medium text-destructive">{errors.startTime}</span>}
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            Planning speed (mph)
            <input type="number" inputMode="decimal" min={35} max={75} step={1} value={v.speed} onChange={(e) => setV({ ...v, speed: e.target.value })} className={cn("tabular h-11 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", errors.averageSpeedMph ? "border-destructive" : "border-input")} />
            {errors.averageSpeedMph && <span role="alert" className="block text-xs font-medium text-destructive">{errors.averageSpeedMph}</span>}
          </label>
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

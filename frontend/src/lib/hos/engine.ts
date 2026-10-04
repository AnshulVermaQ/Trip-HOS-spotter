import { CITIES, TRIP_START_DATE, TRIP_START_MINUTE } from "./mock-data";
import type {
  DailyLog,
  DutyEvent,
  DutyStatus,
  EventKind,
  GeoPoint,
  HosWarning,
  LogSegment,
  TripInput,
  TripPlan,
} from "./types";

/** Modeled HOS rules (property-carrying, 70h/8-day). */
export const RULES = {
  avgSpeedMph: 55,
  roadFactor: 1.18, // great-circle -> road miles
  maxDrive: 11 * 60,
  window: 14 * 60,
  breakAfter: 8 * 60,
  breakLen: 30,
  resetLen: 10 * 60,
  cycle: 70 * 60,
  restartLen: 34 * 60,
  fuelEvery: 1000,
  fuelLen: 30,
  handling: 60,
};

const EPS = 1e-6;

export function haversineMiles(a: GeoPoint, b: GeoPoint) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function placeAt(a: GeoPoint, b: GeoPoint, f: number): GeoPoint {
  const lat = a.lat + (b.lat - a.lat) * f;
  const lng = a.lng + (b.lng - a.lng) * f;
  let best = CITIES[0]!;
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = haversineMiles({ name: "", lat, lng }, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  const name = bestD < 15 ? best.name : `${Math.round(bestD)} mi from ${best.name}`;
  return { name, lat, lng };
}

export function planTripLocal(
  input: TripInput,
  points: { current: GeoPoint; pickup: GeoPoint; dropoff: GeoPoint },
): TripPlan {
  const events: DutyEvent[] = [];
  let t = 0;
  let shiftDrive = 0;
  let windowStart: number | null = null;
  let sinceBreak = 0;
  let sinceFuel = 0;
  let cycle = input.cycleUsedHours * 60;
  let pos: GeoPoint = points.current;

  const push = (kind: EventKind, status: DutyStatus, dur: number, note: string, miles?: number, loc = pos) => {
    events.push({ id: `e${events.length}`, kind, status, start: t, end: t + dur, location: loc, note, miles });
    t += dur;
  };

  const rest = () => {
    push("rest", "SB", RULES.resetLen, "10-hr off-duty reset (sleeper berth)");
    shiftDrive = 0;
    windowStart = null;
    sinceBreak = 0;
  };
  const restart = () => {
    push("restart", "OFF", RULES.restartLen, "34-hr cycle restart (70-hr limit reached)");
    cycle = 0;
    shiftDrive = 0;
    windowStart = null;
    sinceBreak = 0;
  };

  const onDuty = (kind: EventKind, dur: number, note: string) => {
    if (cycle + dur > RULES.cycle + EPS) restart();
    if (windowStart === null) windowStart = t;
    push(kind, "ON", dur, note);
    cycle += dur;
    if (dur >= RULES.breakLen) sinceBreak = 0;
  };

  const drive = (from: GeoPoint, to: GeoPoint) => {
    const miles = haversineMiles(from, to) * RULES.roadFactor;
    let covered = 0;
    let guard = 0;
    while (miles - covered > 0.05 && guard++ < 500) {
      pos = placeAt(from, to, covered / miles);
      if (windowStart === null) windowStart = t;
      const cycleLeft = RULES.cycle - cycle;
      const shiftLeft = RULES.maxDrive - shiftDrive;
      const windowLeft = RULES.window - (t - windowStart);
      const breakLeft = RULES.breakAfter - sinceBreak;
      const fuelLeft = ((RULES.fuelEvery - sinceFuel) / RULES.avgSpeedMph) * 60;
      const remain = ((miles - covered) / RULES.avgSpeedMph) * 60;

      if (cycleLeft <= EPS) { restart(); continue; }
      if (shiftLeft <= EPS || windowLeft <= EPS) { rest(); continue; }
      if (fuelLeft <= 0.5) {
        onDuty("fuel", RULES.fuelLen, "Fueling stop (counts as 30-min break)");
        sinceFuel = 0;
        continue;
      }
      if (breakLeft <= EPS) {
        push("break", "OFF", RULES.breakLen, "30-min break after 8 hrs driving");
        sinceBreak = 0;
        continue;
      }
      const dur = Math.min(cycleLeft, shiftLeft, windowLeft, breakLeft, fuelLeft, remain);
      const segMiles = (dur / 60) * RULES.avgSpeedMph;
      push("drive", "D", dur, `Driving toward ${to.name}`, segMiles);
      covered += segMiles;
      shiftDrive += dur;
      sinceBreak += dur;
      sinceFuel += segMiles;
      cycle += dur;
    }
    pos = to;
    return miles;
  };

  // Pre-trip: off duty from midnight (assumes a qualifying 10-hr reset already completed).
  push("prior", "OFF", TRIP_START_MINUTE, "Off duty — prior reset completed");
  const tripStart = t;
  const toPickup = drive(points.current, points.pickup);
  onDuty("pickup", RULES.handling, "Pickup — loading at shipper");
  const toDropoff = drive(points.pickup, points.dropoff);
  onDuty("dropoff", RULES.handling, "Dropoff — unloading at receiver");
  const tripEnd = t;
  const dayEnd = Math.ceil(t / 1440) * 1440;
  if (dayEnd - t > EPS) push("end", "OFF", dayEnd - t, "Off duty — trip complete");

  const sum = (s: DutyStatus) => events.filter((e) => e.status === s).reduce((a, e) => a + e.end - e.start, 0);
  const count = (k: EventKind) => events.filter((e) => e.kind === k).length;
  const counts = { breaks: count("break") + count("fuel"), fuel: count("fuel"), rests: count("rest"), restarts: count("restart") };
  const cycleRemainingMinutes = Math.max(0, RULES.cycle - cycle);

  const warnings: HosWarning[] = [];
  if (counts.restarts > 0) {
    warnings.push({
      level: "critical",
      title: "34-hour restart required",
      message: `Available cycle time (${(70 - input.cycleUsedHours).toFixed(1)} h) is insufficient. The plan inserts ${counts.restarts} 34-hour restart(s).`,
    });
  } else if (cycleRemainingMinutes < 8 * 60) {
    warnings.push({
      level: "warning",
      title: "Low cycle availability after delivery",
      message: `Only ${(cycleRemainingMinutes / 60).toFixed(1)} h of the 70-hr cycle remain after this trip.`,
    });
  }
  warnings.push({
    level: "info",
    title: "Rolling 8-day availability",
    message: "Cycle hours are modeled from the entered baseline. Actual rolling availability requires historical duty records.",
  });

  return {
    id: `plan-${points.current.name}-${points.dropoff.name}-${input.cycleUsedHours}`.replace(/[^a-z0-9-]/gi, ""),
    input,
    startDate: TRIP_START_DATE,
    points,
    totalMiles: toPickup + toDropoff,
    legMiles: { toPickup, toDropoff },
    drivingMinutes: sum("D"),
    onDutyMinutes: sum("ON"),
    handlingMinutes: RULES.handling * 2,
    tripMinutes: tripEnd - tripStart,
    events,
    logs: buildDailyLogs(events, TRIP_START_DATE),
    counts,
    cycleRemainingMinutes,
    warnings,
  };
}

export function buildDailyLogs(events: DutyEvent[], startDate: string): DailyLog[] {
  const last = events[events.length - 1]?.end ?? 1440;
  const days = Math.max(1, Math.round(last / 1440));
  const logs: DailyLog[] = [];
  for (let d = 0; d < days; d++) {
    const ds = d * 1440;
    const de = ds + 1440;
    const segments: LogSegment[] = [];
    let miles = 0;
    const remarks: DailyLog["remarks"] = [];
    for (const e of events) {
      const s = Math.max(e.start, ds);
      const en = Math.min(e.end, de);
      if (en - s <= EPS) continue;
      const prev = segments[segments.length - 1];
      if (prev && prev.status === e.status && Math.abs(prev.end - (s - ds)) < EPS) prev.end = en - ds;
      else segments.push({ status: e.status, start: s - ds, end: en - ds });
      if (e.miles) miles += e.miles * ((en - s) / (e.end - e.start));
      if (e.start >= ds - EPS && e.start < de) {
        remarks.push({ time: e.start - ds, status: e.status, location: e.location.name, note: e.note });
      }
    }
    const totals = { OFF: 0, SB: 0, D: 0, ON: 0 } as Record<DutyStatus, number>;
    for (const s of segments) totals[s.status] += s.end - s.start;
    const date = new Date(`${startDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + d);
    logs.push({ day: d + 1, date: date.toISOString().slice(0, 10), segments, remarks, totals, miles });
  }
  return logs;
}

/** Re-evaluate edited logs independently of the trip generator. */
export function auditEditedEvents(events: DutyEvent[], initialCycleHours: number): HosWarning[] {
  const warnings: HosWarning[] = [];
  const flag = (title: string, message: string) => {
    if (!warnings.some((w) => w.title === title)) warnings.push({ level: "critical", title, message });
  };
  let drive = 0;
  let sinceBreak = 0;
  let windowStart: number | null = null;
  let offRun = 0;
  let breakRun = 0;
  let cycle = initialCycleHours * 60;
  for (const event of events) {
    const duration = event.end - event.start;
    if (duration <= 0 || !Number.isFinite(duration)) {
      flag("Invalid event duration", "Each event must have a positive duration.");
      continue;
    }
    if (event.status === "OFF" || event.status === "SB") {
      offRun += duration;
      breakRun += duration;
      if (offRun >= RULES.resetLen) { drive = 0; windowStart = null; sinceBreak = 0; }
      if (offRun >= RULES.restartLen) cycle = 0;
    } else {
      if (breakRun >= RULES.breakLen) sinceBreak = 0;
      breakRun = 0;
      offRun = 0;
      if (windowStart === null) windowStart = event.start;
      if (event.status === "ON" && duration >= RULES.breakLen) {
        sinceBreak = 0;
      }
      if (event.status === "D") {
        if (drive + duration > RULES.maxDrive + EPS) flag("11-hour driving limit exceeded", "Driving exceeds 11 hours without a qualifying 10-hour off-duty reset.");
        if (event.end - windowStart > RULES.window + EPS) flag("14-hour driving window exceeded", "Driving occurs after the 14-hour window has closed.");
        if (sinceBreak + duration > RULES.breakAfter + EPS) flag("30-minute break required", "Driving exceeds 8 cumulative hours without a qualifying 30-minute break.");
        drive += duration;
        sinceBreak += duration;
      }
      cycle += duration;
      if (cycle > RULES.cycle + EPS) flag("70-hour cycle exceeded", "On-duty time exceeds the modeled 70-hour cycle. Rolling availability needs historical records.");
    }
  }
  warnings.push({ level: "info", title: "Rolling 8-day availability", message: "Cycle hours are modeled from the entered baseline. Actual rolling availability requires historical duty records." });
  return warnings;
}

/* ---------- formatting helpers ---------- */
export function fmtDuration(min: number) {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${String(r).padStart(2, "0")}m`;
}
export function fmtHours(min: number) {
  return (Math.round((min / 60) * 100) / 100).toFixed(2);
}
export function fmtClock(minInDay: number) {
  const m = Math.round(minInDay) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
export function eventDay(min: number) {
  return Math.floor(min / 1440) + 1;
}

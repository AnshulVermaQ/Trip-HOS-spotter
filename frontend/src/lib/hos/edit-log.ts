import { z } from "zod";
import { auditEditedEvents, buildDailyLogs, RULES } from "./engine";
import { geocode } from "./mock-data";
import type { DriverDetails, DutyEvent, DutyStatus, TripPlan } from "./types";

const kinds = ["drive", "pickup", "dropoff", "fuel", "break", "rest", "restart"] as const;
const statuses = ["OFF", "SB", "D", "ON"] as const;
export const eventEditSchema = z.object({
  kind: z.enum(kinds), status: z.enum(statuses),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time."),
  duration: z.coerce.number().int().min(1, "Use at least one minute.").max(1440, "Use 24 hours or less."),
  location: z.string().trim().min(1).max(120), note: z.string().trim().min(1).max(500),
});
export type EventEdit = z.infer<typeof eventEditSchema>;
export const detailsSchema = z.object({
  driverName: z.string().trim().min(1).max(120), driverSignature: z.string().trim().min(1).max(120),
  coDriver: z.string().trim().min(1).max(120), homeTerminal: z.string().trim().min(1).max(120),
  carrier: z.string().trim().min(1).max(120), carrierAddress: z.string().trim().min(1).max(200),
  truck: z.string().trim().min(1).max(80), trailer: z.string().trim().min(1).max(80),
  shippingDoc: z.string().trim().min(1).max(120), shipperCommodity: z.string().trim().min(1).max(200),
});

const clock = (time: string) => { const [h = 0, m = 0] = time.split(":").map(Number); return h * 60 + m; };

function normalize(events: DutyEvent[]): DutyEvent[] {
  const copy = events.map((e) => ({ ...e }));
  const last = copy.at(-1);
  if (!last) return copy;
  const end = Math.ceil(last.end / 1440) * 1440;
  if (end - last.end > 0) copy.push({ id: `end-${Date.now()}`, kind: "end", status: "OFF", start: last.end, end, location: last.location, note: "Off duty — end of recorded day" });
  return copy;
}

function finalize(plan: TripPlan, events: DutyEvent[], details = plan.driverDetails): TripPlan {
  const logs = buildDailyLogs(events, plan.startDate);
  const sum = (status: DutyStatus) => events.reduce((n, e) => n + (e.status === status ? e.end - e.start : 0), 0);
  const counts = { breaks: events.filter((e) => e.kind === "break" || e.kind === "fuel").length, fuel: events.filter((e) => e.kind === "fuel").length, rests: events.filter((e) => e.kind === "rest").length, restarts: events.filter((e) => e.kind === "restart").length };
  const lastActivity = [...events].reverse().find((e) => e.kind !== "end")?.end ?? 0;
  return { ...plan, events, logs, ...(details ? { driverDetails: details } : {}), drivingMinutes: sum("D"), onDutyMinutes: sum("ON"), tripMinutes: lastActivity - (events.find((e) => e.kind !== "prior")?.start ?? 0), counts,
    cycleRemainingMinutes: Math.max(0, RULES.cycle - plan.input.cycleUsedHours * 60 - sum("D") - sum("ON")),
    warnings: auditEditedEvents(events, plan.input.cycleUsedHours) };
}

export function updateDriverDetails(plan: TripPlan, value: DriverDetails): TripPlan {
  return { ...plan, driverDetails: detailsSchema.parse(value) };
}

/** Adjust the preceding boundary, then shift following events by the changed duration. */
export function editDutyEvent(plan: TripPlan, id: string, raw: EventEdit): TripPlan {
  const value = eventEditSchema.parse(raw);
  const index = plan.events.findIndex((e) => e.id === id);
  const source = plan.events[index];
  if (!source || source.kind === "prior" || source.kind === "end") throw new Error("Choose a recorded trip event.");
  const start = Math.floor(source.start / 1440) * 1440 + clock(value.time);
  const previous = plan.events[index - 1];
  if (previous && start <= previous.start) throw new Error("Start time must be after the previous event begins.");
  if (start >= source.end) throw new Error("Start time must be before this event ends.");
  const location = geocode(value.location) ?? { ...source.location, name: value.location };
  const end = start + value.duration;
  const delta = end - source.end;
  const events = plan.events.map((e, i) => i === index - 1 ? { ...e, end: start } : i === index ? { ...e, start, end, kind: value.kind, status: value.status, location, note: value.note, miles: value.status === "D" && e.status === "D" ? e.miles : undefined } : i > index ? { ...e, start: e.start + delta, end: e.end + delta } : { ...e });
  if ((events.at(-1)?.end ?? 0) > 1440 * 14) throw new Error("The edited trip cannot exceed 14 days.");
  const tail = events.at(-1);
  if (tail?.kind === "end") events.pop();
  return finalize(plan, normalize(events));
}

/** Insert a stop after the chosen event, shifting later events without a gap. */
export function addDutyEvent(plan: TripPlan, afterId: string, raw: EventEdit): TripPlan {
  const value = eventEditSchema.parse(raw);
  const index = plan.events.findIndex((e) => e.id === afterId);
  const anchor = plan.events[index];
  if (!anchor || anchor.kind === "end") throw new Error("Choose a trip event before the end of the day.");
  const start = anchor.end;
  const location = geocode(value.location) ?? { ...anchor.location, name: value.location };
  const duration = value.duration;
  const added: DutyEvent = { id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind: value.kind, status: value.status, start, end: start + duration, location, note: value.note };
  const events = plan.events.flatMap((e, i) => i === index ? [{ ...e }, added] : i > index ? [{ ...e, start: e.start + duration, end: e.end + duration }] : [{ ...e }]);
  if ((events.at(-1)?.end ?? 0) > 1440 * 14) throw new Error("The edited trip cannot exceed 14 days.");
  if (events.at(-1)?.kind === "end") events.pop();
  return finalize(plan, normalize(events));
}

export function deleteDutyEvent(plan: TripPlan, id: string): TripPlan {
  const index = plan.events.findIndex((e) => e.id === id);
  const source = plan.events[index];
  if (!source || index < 1 || source.kind === "end") throw new Error("Choose a recorded trip event.");
  const duration = source.end - source.start;
  const events = plan.events.filter((e) => e.id !== id).map((e, i) => i >= index ? { ...e, start: e.start - duration, end: e.end - duration } : { ...e });
  if (events.at(-1)?.kind === "end") events.pop();
  return finalize(plan, normalize(events));
}

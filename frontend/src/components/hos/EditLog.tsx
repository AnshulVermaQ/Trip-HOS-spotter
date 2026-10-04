import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtClock, fmtDate } from "@/lib/hos/engine";
import { addDutyEvent, deleteDutyEvent, detailsSchema, editDutyEvent, eventEditSchema, updateDriverDetails, type EventEdit } from "@/lib/hos/edit-log";
import { MOCK_DRIVER } from "@/lib/hos/mock-data";
import { saveTrip } from "@/lib/api/hos-api";
import { setCurrentPlan } from "@/lib/trip-store";
import { DUTY_LABELS, type DriverDetails, type DutyEvent, type TripPlan } from "@/lib/hos/types";
import { kindLabel } from "./ui";

const inputClass = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
const defaultDetails: DriverDetails = {
  driverName: MOCK_DRIVER.name,
  driverSignature: MOCK_DRIVER.signature,
  coDriver: MOCK_DRIVER.coDriver,
  homeTerminal: MOCK_DRIVER.homeTerminal,
  carrier: MOCK_DRIVER.carrier,
  carrierAddress: MOCK_DRIVER.carrierAddress,
  truck: MOCK_DRIVER.truck,
  trailer: MOCK_DRIVER.trailer,
  shippingDoc: MOCK_DRIVER.shippingDoc,
  shipperCommodity: MOCK_DRIVER.shipperCommodity,
};
export function getDriverDetails(plan: TripPlan) { return plan.driverDetails ?? defaultDetails; }

export function EditLog({ plan, day, onClose }: { plan: TripPlan; day: number; onClose: () => void }) {
  const events = plan.events.filter((e) => e.start < day * 1440 && e.end > (day - 1) * 1440 && e.kind !== "end");
  const firstEditable = events.find((e) => e.kind !== "prior") ?? null;
  const [target, setTarget] = useState<DutyEvent | null>(firstEditable);
  const [adding, setAdding] = useState(false);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [form, setForm] = useState<EventEdit>(firstEditable ? { kind: firstEditable.kind === "end" || firstEditable.kind === "prior" ? "break" : firstEditable.kind, status: firstEditable.status, time: fmtClock(firstEditable.start), duration: Math.round(firstEditable.end - firstEditable.start), location: firstEditable.location.name, note: firstEditable.note } : { kind: "break", status: "OFF", time: "12:00", duration: 30, location: plan.points.current.name, note: "30-minute break" });
  const [details, setDetails] = useState<DriverDetails>(getDriverDetails(plan));
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"events" | "details">("events");
  const editorRef = useRef<HTMLElement>(null);
  useEffect(() => { editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);
  useEffect(() => { setDetails(getDriverDetails(plan)); }, [plan.id]);
  const persist = async (next: TripPlan) => {
    setCurrentPlan(next);
    try {
      const saved = await saveTrip(next);
      setCurrentPlan(saved);
      return true;
    } catch (err) {
      setError(err instanceof Error ? `Saved locally, but server update failed: ${err.message}` : "Saved locally, but server update failed.");
      return false;
    }
  };
  const choose = (e: DutyEvent) => { setAdding(false); setTarget(e); setError(""); setForm({ kind: e.kind === "prior" || e.kind === "end" ? "break" : e.kind, status: e.status, time: fmtClock(e.start), duration: Math.round(e.end - e.start), location: e.location.name, note: e.note }); };
  const newEvent = (after: DutyEvent) => { setAdding(true); setTarget(null); setAnchorId(after.id); setError(""); setForm({ kind: "break", status: "OFF", time: fmtClock(after.end), duration: 30, location: after.location.name, note: "30-minute break" }); };
  const saveEvent = async () => {
    const parsed = eventEditSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the event details."); return; }
    try {
      const next = adding ? addDutyEvent(plan, anchorId ?? "", parsed.data) : editDutyEvent(plan, target?.id ?? "", parsed.data);
      if (await persist(next)) { setTarget(null); setAdding(false); setError(""); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update event."); }
  };
  const saveDetails = async () => {
    const parsed = detailsSchema.safeParse(details);
    if (!parsed.success) { setError(`${parsed.error.issues[0]?.path.join(" ")}: ${parsed.error.issues[0]?.message}`); return; }
    if (await persist(updateDriverDetails(plan, parsed.data))) { setError(""); onClose(); }
  };
   return <section ref={editorRef} className="no-print mt-4 scroll-mt-16 border-t border-border pt-4" aria-label="Edit driver log">
    <div className="flex items-center justify-between gap-3"><h4 className="text-base font-semibold">Edit Log · {fmtDate(plan.logs[day - 1]?.date ?? plan.startDate)}</h4><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close log editor"><X className="size-4" /></Button></div>
    <div className="mt-3 flex gap-1 border-b border-border"><Button variant={tab === "events" ? "secondary" : "ghost"} onClick={() => { setTab("events"); setError(""); }}>Duty events</Button><Button variant={tab === "details" ? "secondary" : "ghost"} onClick={() => { setTab("details"); setError(""); }}>Log details</Button></div>
    {tab === "events" ? <div className="mt-4 space-y-4">
      {(adding || target) && <div className="grid gap-3 rounded-md border border-border bg-muted p-4 sm:grid-cols-2">
        <h5 className="text-sm font-semibold sm:col-span-2">{adding ? "Add duty event" : `Edit ${kindLabel[target?.kind ?? "break"]} event`}</h5>
        <label className="space-y-1 text-sm font-medium">Event type<select aria-label="Event type" className={inputClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventEdit["kind"], status: e.target.value === "drive" ? "D" : e.target.value === "rest" || e.target.value === "restart" ? "OFF" : e.target.value === "pickup" || e.target.value === "dropoff" || e.target.value === "fuel" ? "ON" : "OFF" })}>{["drive", "pickup", "dropoff", "fuel", "break", "rest", "restart"].map((k) => <option key={k} value={k}>{kindLabel[k as EventEdit["kind"]]}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium">Duty status<select aria-label="Duty status" className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EventEdit["status"] })}>{Object.entries(DUTY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium">Start time<input aria-label="Start time" type="time" className={inputClass} value={form.time} disabled={adding} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
        <label className="space-y-1 text-sm font-medium">Duration (minutes)<input aria-label="Duration (minutes)" type="number" min="1" max="1440" className={inputClass} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} /></label>
        <label className="space-y-1 text-sm font-medium">Location<input aria-label="Event location" maxLength={120} className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
        <label className="space-y-1 text-sm font-medium">Remarks<input aria-label="Event remarks" maxLength={500} className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        <div className="flex gap-2 sm:col-span-2"><Button onClick={saveEvent}>Save event</Button><Button variant="outline" onClick={() => { setTarget(null); setAdding(false); setError(""); }}>Cancel</Button></div>
      </div>}
      <div className="max-h-56 divide-y divide-border overflow-y-auto border-y border-border">{events.map((e) => <div key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm"><div className="min-w-0"><span className="tabular font-semibold">{fmtClock(e.start)} · {kindLabel[e.kind]}</span><span className="ml-2 text-muted-foreground">{DUTY_LABELS[e.status]} · {e.location.name}</span></div><div className="flex shrink-0"><Button size="icon" variant="ghost" aria-label={`Add event after ${kindLabel[e.kind]} at ${fmtClock(e.start)}`} onClick={() => newEvent(e)}><Plus className="size-4" /></Button>{e.kind !== "prior" && <><Button size="icon" variant="ghost" aria-label={`Edit ${kindLabel[e.kind]} at ${fmtClock(e.start)}`} onClick={() => choose(e)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={`Remove ${kindLabel[e.kind]} at ${fmtClock(e.start)}`} onClick={async () => { try { await persist(deleteDutyEvent(plan, e.id)); setTarget(null); setError(""); } catch (err) { setError(err instanceof Error ? err.message : "Could not remove event."); } }}><Trash2 className="size-4" /></Button></>}</div></div>)}</div>
      {events.at(-1) && <Button variant="outline" onClick={() => { const last = events.at(-1); if (last) newEvent(last); }}><Plus className="size-4" /> Add event after this day’s last event</Button>}
    </div> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{([ ["driverName", "Driver name"], ["driverSignature", "Driver signature"], ["coDriver", "Co-driver"], ["homeTerminal", "Home terminal / time base"], ["carrier", "Carrier name"], ["carrierAddress", "Main office address"], ["truck", "Truck number"], ["trailer", "Trailer number"], ["shippingDoc", "Shipping document"], ["shipperCommodity", "Shipper and commodity"] ] as const).map(([key, label]) => <label key={key} className="space-y-1 text-sm font-medium">{label}<input aria-label={label} className={inputClass} maxLength={key === "carrierAddress" ? 200 : key === "truck" || key === "trailer" ? 80 : 120} value={details[key]} onChange={(e) => setDetails({ ...details, [key]: e.target.value })} /></label>)}<div className="flex items-end"><Button onClick={saveDetails}>Save details</Button></div></div>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </section>;
}

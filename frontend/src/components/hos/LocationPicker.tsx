import { useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { ROUTABLE_LOCATIONS } from "@/lib/hos/mock-data";
import { cn } from "@/lib/utils";

export function LocationPicker({ id, label, value, onChange, error }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const query = value.trim().toLowerCase();
  const matches = query && open ? ROUTABLE_LOCATIONS.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 80) : ROUTABLE_LOCATIONS.slice(0, 80);
  const choose = (name: string) => { onChange(name); setOpen(false); setActive(0); };
  return <div ref={box} className="relative space-y-1.5">
    <label htmlFor={id} className="block text-xs font-semibold uppercase text-muted-foreground">{label}</label>
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent" aria-hidden />
      <input id={id} role="combobox" aria-autocomplete="list" aria-controls={`${id}-list`} aria-expanded={open} aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined} value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }} onFocus={() => { setOpen(true); setActive(0); }} onBlur={(e) => { if (!box.current?.contains(e.relatedTarget)) setOpen(false); }} onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((n) => Math.min(n + 1, matches.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActive((n) => Math.max(0, n - 1)); }
        if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); choose(matches[active].name); }
        if (e.key === "Escape") setOpen(false);
      }} autoComplete="off" placeholder="Search city or town" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} className={cn("h-11 w-full rounded-md border bg-secondary pl-9 pr-10 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring", error ? "border-destructive" : "border-input")} />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
    {open && <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground"><Search className="size-3.5" /> {query ? `Road-connected US locations matching “${value}”` : "Major cities first · contiguous US road routes"}</div>
      <ul id={`${id}-list`} role="listbox" className="max-h-52 overflow-y-auto py-1">
        {matches.length ? matches.map((city, index) => <li key={city.name} id={`${id}-option-${index}`} role="option" aria-selected={value === city.name} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(city.name)} className={cn("flex cursor-pointer items-center justify-between px-3 py-2 text-sm", active === index ? "bg-accent text-accent-foreground" : "hover:bg-secondary")}>{city.name}{value === city.name && <Check className="size-4" />}</li>) : <li className="px-3 py-3 text-sm text-muted-foreground">No matching US location</li>}
      </ul>
      {matches.length === 80 && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Keep typing to narrow the list</p>}
    </div>}
    {error && <p id={`${id}-err`} role="alert" className="text-xs font-medium text-destructive">{error}</p>}
  </div>;
}

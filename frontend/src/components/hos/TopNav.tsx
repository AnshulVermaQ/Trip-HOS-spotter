import { Link } from "@tanstack/react-router";
import { Route } from "lucide-react";

const links = [
  { to: "/", label: "Trip Planner" },
  { to: "/logs", label: "Log Sheets" },
  { to: "/history", label: "Trip History" },
] as const;

export function TopNav() {
  return (
    <header className="no-print sticky top-0 z-[1100] border-b border-white/10 bg-navy text-navy-foreground shadow-[0_8px_24px_-16px_rgba(2,15,31,0.85)]">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-4 px-4 sm:gap-7 sm:px-6">
        <Link to="/" className="group flex shrink-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/80">
          <span className="spotter-mark grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/12 bg-[oklch(0.21_0.05_260)] shadow-sm">
            <img src="/spotter-logo.png" alt="Spotter" className="size-full scale-[1.48] object-cover" />
          </span>
          <span className="leading-none">
            <span className="block text-lg font-semibold tracking-tight">Spotter</span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.15em] text-navy-muted">HOS planner</span>
          </span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-navy-muted transition hover:bg-white/7 hover:text-navy-foreground"
              activeProps={{ className: "bg-white/12 !text-navy-foreground font-medium shadow-sm" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-medium text-navy-muted md:flex">
          <Route className="size-3.5 text-accent" aria-hidden />
          Property carrier
        </div>
      </div>
    </header>
  );
}

export function Disclaimer() {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning-soft px-3 py-1 text-xs font-medium">
      <span className="size-1.5 rounded-full bg-warning" /> Planning aid only — verify HOS compliance before operating.
    </p>
  );
}

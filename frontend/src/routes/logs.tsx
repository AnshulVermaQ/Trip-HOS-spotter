import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentPlan } from "@/lib/trip-store";
import { DailyLogTabs } from "@/components/hos/DailyLogTabs";
import { Disclaimer } from "@/components/hos/TopNav";
import { HOSAlerts } from "@/components/hos/HOSAlerts";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Log Sheets — Spotter HOS Planner" },
      { name: "description", content: "Printable 24-hour ELD driver's daily log sheets for the planned trip." },
      { property: "og:title", content: "Log Sheets — Spotter HOS Planner" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Printable 24-hour driver's daily log sheets." },
    ],
  }),
  component: LogsPage,
});

function LogsPage() {
  const plan = useCurrentPlan();
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Log Sheets</h1>
          <p className="mt-1 text-muted-foreground">
            {plan.points.current.name} → {plan.points.dropoff.name} ·{" "}
            <Link to="/" className="font-medium text-primary underline-offset-4 hover:underline">Edit trip</Link>
          </p>
        </div>
        <Disclaimer />
      </div>
      <HOSAlerts plan={plan} />
      <DailyLogTabs plan={plan} />
    </main>
  );
}

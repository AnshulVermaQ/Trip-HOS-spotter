import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { getTripHistory } from "@/lib/api/hos-api";
import { fmtDate } from "@/lib/hos/engine";
import { Card, CardHeader } from "@/components/hos/ui";

const historyQuery = queryOptions({ queryKey: ["trip-history"], queryFn: getTripHistory });

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Trip History — Spotter HOS Planner" },
      { name: "description", content: "Previously planned and completed trips with miles and log days." },
      { property: "og:title", content: "Trip History — Spotter HOS Planner" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Previously planned and completed trips." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(historyQuery),
  component: HistoryPage,
});

function HistoryPage() {
  const { data } = useSuspenseQuery(historyQuery);
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Trip History</h1>
      <Card>
        <CardHeader icon={<History className="size-4" />} title="Recent trips" subtitle="Demo data — will load from the backend once connected." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                {["Trip", "Date", "Route", "Miles", "Days", "Status"].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-mono font-medium">{t.id}</td>
                  <td className="px-5 py-3">{fmtDate(t.date)}</td>
                  <td className="px-5 py-3">{t.route}</td>
                  <td className="tabular px-5 py-3">{t.miles.toLocaleString()}</td>
                  <td className="tabular px-5 py-3">{t.days}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium capitalize text-success">{t.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}

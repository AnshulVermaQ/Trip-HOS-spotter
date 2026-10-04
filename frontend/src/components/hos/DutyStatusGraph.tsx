import type React from "react";
import { fmtHours } from "@/lib/hos/engine";
import { DUTY_ORDER, type DailyLog } from "@/lib/hos/types";

const LABEL_W = 120;
const GRID_W = 960;
const TOTAL_W = 70;
const HEADER = 22;
const ROW = 40;
const W = LABEL_W + GRID_W + TOTAL_W;
const H = HEADER + ROW * 4 + 22;

const rowLabels = ["1. Off Duty", "2. Sleeper Berth", "3. Driving", "4. On Duty (not driving)"];
const x = (m: number) => LABEL_W + (m / 1440) * GRID_W;
const hourLabel = (h: number) => (h === 0 || h === 24 ? "Mid" : h === 12 ? "Noon" : String(h % 12));

export function DutyStatusGraph({ log }: { log: DailyLog }) {
  const rowY = (s: (typeof DUTY_ORDER)[number]) => HEADER + DUTY_ORDER.indexOf(s) * ROW + ROW / 2;
  let d = "";
  log.segments.forEach((s, i) => {
    const y = rowY(s.status);
    if (i === 0) d += `M${x(s.start)},${y}`;
    else d += `V${y}`;
    d += `H${x(s.end)}`;
  });

  const ticks: React.ReactElement[] = [];
  for (let q = 0; q <= 96; q++) {
    const xx = x(q * 15);
    const hour = q % 4 === 0;
    for (let r = 0; r < 4; r++) {
      const top = HEADER + r * ROW;
      if (hour) ticks.push(<line key={`${q}-${r}`} x1={xx} x2={xx} y1={top} y2={top + ROW} stroke="var(--log-ink)" strokeOpacity={0.35} strokeWidth={0.8} />);
      else {
        const len = q % 2 === 0 ? ROW * 0.5 : ROW * 0.28;
        ticks.push(<line key={`${q}-${r}`} x1={xx} x2={xx} y1={top} y2={top + len} stroke="var(--log-ink)" strokeOpacity={0.3} strokeWidth={0.6} />);
      }
    }
  }
  const total = Object.values(log.totals).reduce((a, b) => a + b, 0);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block min-w-[640px] w-full" role="img" aria-label={`Duty status graph for day ${log.day}`}>
        {Array.from({ length: 25 }, (_, h) => (
          <text key={h} x={x(h * 60)} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--log-ink)">
            {hourLabel(h)}
          </text>
        ))}
        <text x={LABEL_W + GRID_W + TOTAL_W / 2} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--log-ink)">
          Total hrs
        </text>
        {DUTY_ORDER.map((s, r) => (
          <g key={s}>
            <rect x={LABEL_W} y={HEADER + r * ROW} width={GRID_W} height={ROW} fill={r % 2 ? "var(--muted)" : "var(--card)"} stroke="var(--log-ink)" strokeOpacity={0.6} />
            <text x={6} y={HEADER + r * ROW + ROW / 2 + 4} fontSize={11} fontWeight={600} fill="var(--log-ink)">
              {rowLabels[r]}
            </text>
            <text x={LABEL_W + GRID_W + TOTAL_W / 2} y={HEADER + r * ROW + ROW / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={700} className="tabular" fill="var(--log-ink)">
              {fmtHours(log.totals[s])}
            </text>
          </g>
        ))}
        {ticks}
        <path d={d} fill="none" stroke="var(--duty-d)" strokeWidth={3} strokeLinejoin="miter" strokeLinecap="square" />
        <text x={LABEL_W + GRID_W - 4} y={H - 6} textAnchor="end" fontSize={11} fill="var(--log-ink)">
          Total = 
        </text>
        <text x={LABEL_W + GRID_W + TOTAL_W / 2} y={H - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--log-ink)" className="tabular">
          {fmtHours(total)}
        </text>
      </svg>
    </div>
  );
}

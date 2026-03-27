import { Card } from "@/components/ui/card";
import type { LiveKpiSeriesPoint } from "@/types/live-kpi-dashboard";

export function KpiModalChart({ points }: { points: LiveKpiSeriesPoint[] }) {
  const max = Math.max(...points.map((point) => point.count), 1);

  return (
    <Card className="p-5">
      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
        Por dia
      </div>
      <div className="mt-5 flex h-52 items-end gap-2">
        {points.map((point) => (
          <div key={point.date} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-full w-full items-end rounded-full bg-[color:rgba(22,22,30,0.04)] px-1">
              <div
                className="w-full rounded-t-[18px] bg-[linear-gradient(180deg,var(--color-accent),var(--color-navy))]"
                style={{ height: `${Math.max((point.count / max) * 100, 8)}%` }}
              />
            </div>
            <div className="text-center text-[11px] font-semibold text-[var(--color-muted)]">
              {point.date.slice(5)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

import { Card } from "@/components/ui/card";
import type { LiveKpiSeriesPoint } from "@/types/live-kpi-dashboard";

export function KpiModalDailyList({ points }: { points: LiveKpiSeriesPoint[] }) {
  return (
    <Card className="p-5">
      <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
        Por dia
      </div>
      <div className="mt-5 max-h-72 space-y-3 overflow-auto pr-2">
        {points.map((point) => (
          <div
            key={point.date}
            className="flex items-center justify-between rounded-2xl border border-[color:var(--color-line)] bg-white/80 px-4 py-3"
          >
            <div>
              <div className="text-sm font-semibold text-[var(--color-ink)]">{point.date}</div>
              <div className="text-xs text-[var(--color-muted)]">
                Quantidade: {point.count.toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="text-sm font-semibold text-[var(--color-navy)]">{point.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

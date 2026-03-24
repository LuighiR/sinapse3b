import { Card } from "@/components/ui/card";
import type { TrendPoint } from "@/types/budget-dashboard";

export function KpiTrendCard({
  title,
  subtitle,
  points,
}: {
  title: string;
  subtitle: string;
  points: TrendPoint[];
}) {
  const max = Math.max(...points.map((point) => point.total));

  return (
    <Card className="p-6">
      <div className="text-xl text-[var(--color-ink)]">{title}</div>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{subtitle}</p>

      <div className="mt-8 flex h-64 items-end gap-4">
        {points.map((point) => (
          <div key={point.label} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-full w-full items-end">
              <div
                className="w-full rounded-t-[18px] bg-[linear-gradient(180deg,var(--color-accent),var(--color-navy))]"
                style={{ height: `${(point.total / max) * 100}%` }}
              />
            </div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              {point.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

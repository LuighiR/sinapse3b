import { Card } from "@/components/ui/card";
import type { ComparisonItem } from "@/types/budget-dashboard";

export function KpiComparisonCard({
  title,
  items,
}: {
  title: string;
  items: ComparisonItem[];
}) {
  return (
    <Card className="p-6">
      <div className="text-xl text-[var(--color-ink)]">{title}</div>
      <div className="mt-6 overflow-hidden rounded-[20px] border border-[color:var(--color-line)]">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr] gap-2 bg-[color:rgba(22,22,30,0.04)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
          <span>Frente</span>
          <span>Atual</span>
          <span>Anterior</span>
          <span>Delta</span>
        </div>
        {items.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr] gap-2 px-4 py-4 text-sm text-[var(--color-ink)] [&:not(:last-child)]:border-t [&:not(:last-child)]:border-[color:var(--color-line)]"
          >
            <span className="font-semibold">{item.label}</span>
            <span>{item.current}</span>
            <span className="text-[var(--color-muted)]">{item.previous}</span>
            <span className="font-semibold text-[var(--color-navy)]">{item.change}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

import { Card } from "@/components/ui/card";
import type { BreakdownItem } from "@/types/budget-dashboard";

export function KpiBreakdownCard({
  title,
  items,
}: {
  title: string;
  items: BreakdownItem[];
}) {
  return (
    <Card className="p-6">
      <div className="text-xl text-[var(--color-ink)]">{title}</div>
      <div className="mt-7 space-y-5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--color-ink)]">{item.label}</span>
              <span className="text-[var(--color-muted)]">{item.value}</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[color:rgba(22,22,30,0.06)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-navy),var(--color-accent))]"
                style={{ width: `${item.share}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

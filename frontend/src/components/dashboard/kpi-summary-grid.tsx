import { Card } from "@/components/ui/card";
import type { SummaryCard } from "@/types/budget-dashboard";

const toneClasses: Record<SummaryCard["tone"], string> = {
  navy: "bg-[linear-gradient(135deg,rgba(32,32,72,0.12),transparent)]",
  accent: "bg-[linear-gradient(135deg,rgba(111,134,255,0.16),transparent)]",
  success: "bg-[linear-gradient(135deg,rgba(112,192,160,0.16),transparent)]",
  neutral: "bg-[linear-gradient(135deg,rgba(200,201,210,0.22),transparent)]",
};

export function KpiSummaryGrid({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <Card
          key={card.label}
          className={`relative overflow-hidden p-5 animate-[sinapse-rise_480ms_ease-out_forwards] ${toneClasses[card.tone]}`}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            {card.label}
          </div>
          <div className="mt-4 text-4xl font-semibold text-[var(--color-ink)]">
            {card.value}
          </div>
          <div className="mt-6 flex items-end justify-between gap-4">
            <span className="text-sm font-semibold text-[var(--color-navy)]">{card.delta}</span>
            <div className="flex h-10 items-end gap-1.5 opacity-85">
              <span className="w-2 rounded-full bg-[var(--color-navy)]" style={{ height: "32%" }} />
              <span className="w-2 rounded-full bg-[var(--color-accent)]" style={{ height: "68%" }} />
              <span className="w-2 rounded-full bg-[var(--color-success)]" style={{ height: "54%" }} />
              <span className="w-2 rounded-full bg-[var(--color-navy)]" style={{ height: "86%" }} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

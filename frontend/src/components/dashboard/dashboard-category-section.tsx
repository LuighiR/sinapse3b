import { Card } from "@/components/ui/card";
import { KpiStatCard } from "@/components/dashboard/kpi-stat-card";
import type {
  DashboardCategorySection as DashboardCategorySectionType,
  LiveKpiCard,
} from "@/types/live-kpi-dashboard";

type DashboardCategorySectionProps = {
  section: DashboardCategorySectionType;
  onOpenCard: (card: LiveKpiCard) => void;
};

export function DashboardCategorySection({
  section,
  onOpenCard,
}: DashboardCategorySectionProps) {
  const max = Math.max(...section.chartSeries.map((point) => point.count), 1);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-[color:var(--color-line)] pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-3xl text-[var(--color-ink)]">{section.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            {section.description}
          </p>
        </div>
        <div className="rounded-xl border border-[color:var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-sm text-[var(--color-muted)]">
          Drilldown disponivel por KPI
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        {section.cards.map((card) => (
          <KpiStatCard key={card.id} card={card} onOpen={onOpenCard} />
        ))}
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-line)] pb-4">
            <div>
              <div className="text-xl text-[var(--color-ink)]">{section.chartTitle}</div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{section.chartDescription}</p>
            </div>
            <div className="rounded-xl bg-[var(--color-paper)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Serie diaria
            </div>
          </div>
          <div className="mt-6 flex h-56 items-end gap-3">
            {section.chartSeries.map((point) => (
              <div key={point.date} className="flex flex-1 flex-col items-center gap-3">
                <div className="flex h-full w-full items-end rounded-xl bg-[var(--color-paper)] px-1.5 py-1.5">
                  <div
                    className="w-full rounded-md bg-[linear-gradient(180deg,#6F7FEA,var(--color-navy))]"
                    style={{ height: `${Math.max((point.count / max) * 100, 6)}%` }}
                  />
                </div>
                <div className="text-center text-[11px] font-semibold text-[var(--color-muted)]">
                  {point.date.slice(5)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="border-b border-[color:var(--color-line)] pb-4 text-xl text-[var(--color-ink)]">
            {section.sideTitle}
          </div>
          <div className="mt-5 space-y-3">
            {section.sideMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-[color:var(--color-line)] bg-[var(--color-paper)] px-4 py-4"
              >
                <div className="text-sm font-semibold text-[var(--color-ink)]">{metric.label}</div>
                <div className="mt-2 text-sm text-[var(--color-navy)]">{metric.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

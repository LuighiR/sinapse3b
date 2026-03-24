import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { KpiBreakdownCard } from "@/components/dashboard/kpi-breakdown-card";
import { KpiComparisonCard } from "@/components/dashboard/kpi-comparison-card";
import { KpiHighlightCard } from "@/components/dashboard/kpi-highlight-card";
import { KpiSummaryGrid } from "@/components/dashboard/kpi-summary-grid";
import { KpiTrendCard } from "@/components/dashboard/kpi-trend-card";
import { budgetDashboardMock } from "@/lib/mock-budget-data";

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <KpiSummaryGrid cards={budgetDashboardMock.summaryCards} />

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <KpiTrendCard
            points={budgetDashboardMock.dailyTrend.points}
            subtitle={budgetDashboardMock.dailyTrend.subtitle}
            title={budgetDashboardMock.dailyTrend.title}
          />
          <KpiBreakdownCard
            items={budgetDashboardMock.statusBreakdown.items}
            title={budgetDashboardMock.statusBreakdown.title}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <KpiComparisonCard
            items={budgetDashboardMock.comparison.items}
            title={budgetDashboardMock.comparison.title}
          />
          <KpiHighlightCard
            note={budgetDashboardMock.highlight.note}
            title={budgetDashboardMock.highlight.title}
            value={budgetDashboardMock.highlight.value}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

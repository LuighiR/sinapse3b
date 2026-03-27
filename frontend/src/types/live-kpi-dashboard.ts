import type { BudgetCardId, SalesCardId } from "@/lib/dashboard-kpi-definitions";
import type { DashboardFilters } from "@/types/dashboard-filters";

export type EmployeeOption = {
  label: string;
  value: string;
};

export type LiveKpiSeriesPoint = {
  date: string;
  count: number;
  value: string;
};

export type LiveKpiChannelPoint = {
  label: string;
  count: number;
  value: string;
};

export type LiveKpiCardModal = {
  title: string;
  periodLabel: string;
  sellerLabel: string;
  countLabel: string;
  valueLabel: string;
  dailySeries: LiveKpiSeriesPoint[];
  channelBreakdown?: LiveKpiChannelPoint[];
};

export type LiveKpiCard = {
  id: BudgetCardId | SalesCardId;
  label: string;
  amount: string;
  quantityLabel: string;
  tone: "navy" | "accent" | "success" | "danger" | "neutral";
  modal: LiveKpiCardModal;
};

export type DashboardInsightMetric = {
  label: string;
  value: string;
};

export type DashboardCategorySection = {
  title: string;
  description: string;
  cards: LiveKpiCard[];
  chartTitle: string;
  chartDescription: string;
  chartSeries: LiveKpiSeriesPoint[];
  sideTitle: string;
  sideMetrics: DashboardInsightMetric[];
};

export type LiveDashboardViewModel = {
  filters: DashboardFilters;
  sellerOptions: EmployeeOption[];
  sections: {
    budgets: DashboardCategorySection;
    sales: DashboardCategorySection;
  };
};

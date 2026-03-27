import {
  getBudgetCardDefinition,
  getSalesCardDefinition,
} from "@/lib/dashboard-kpi-definitions";
import { buildDashboardQueryPeriod } from "@/lib/dashboard-filters";
import { getSinapseJson } from "@/lib/api/sinapse-api";
import type { DashboardFilters } from "@/types/dashboard-filters";
import type {
  DashboardCategorySection,
  EmployeeOption,
  LiveDashboardViewModel,
  LiveKpiChannelPoint,
  LiveKpiSeriesPoint,
} from "@/types/live-kpi-dashboard";

type BudgetSummaryResponse = {
  period: { from: string; to: string; key: string };
  total: { count: number; value: string };
  open: { count: number; value: string };
  won: { count: number; value: string };
  lost: { count: number; value: string };
};

type BudgetDailyResponse = {
  period: { from: string; to: string; key: string };
  series: Array<{ date: string; count: number; value: string }>;
};

type BudgetChannelDailyResponse = {
  period: { from: string; to: string; key: string };
  rows: Array<{ date: string; orderType: string; count: number; value: string }>;
};

type BudgetChannelAbandonmentResponse = {
  period: { from: string; to: string; key: string };
  rows: Array<{ orderType: string; count: number; value: string }>;
};

type SalesSummaryResponse = {
  period: { from: string; to: string; key: string };
  total: { count: number; value: string };
  active: { count: number; value: string };
  canceled: { count: number; value: string };
  averageDaily: { count: string; value: string };
  averageTicket: { value: string };
};

type SalesDailyResponse = {
  period: { from: string; to: string; key: string };
  series: Array<{ date: string; count: number; value: string }>;
};

type SalesChannelDailyResponse = {
  period: { from: string; to: string; key: string };
  rows: Array<{ date: string; orderType: string; count: number; value: string }>;
};

type SalesTicketAverageResponse = {
  period: { from: string; to: string; key: string };
  overall: { count: number; value: string; averageTicket: string };
  channels: Array<{ orderType: string; count: number; value: string; averageTicket: string }>;
};

type EmployeeSummary = {
  id: number;
  name: string;
  branchId: number;
  extensionNumber: string;
  extensionUuid: string;
  chatId: string;
};

type LiveDashboardDataInput = {
  filters: DashboardFilters;
  employees: EmployeeSummary[];
  budgetsSummary: BudgetSummaryResponse;
  budgetDailyTotal: BudgetDailyResponse;
  budgetDailyWon: BudgetDailyResponse;
  budgetDailyOpen: BudgetDailyResponse;
  budgetDailyLost: BudgetDailyResponse;
  budgetChannelDaily: BudgetChannelDailyResponse;
  budgetChannelAbandonment: BudgetChannelAbandonmentResponse;
  salesSummary: SalesSummaryResponse;
  salesDailyTotal: SalesDailyResponse;
  salesDailyCanceled: SalesDailyResponse;
  salesChannelDaily: SalesChannelDailyResponse;
  salesTicketAverage: SalesTicketAverageResponse;
};

export async function getLiveDashboardData(filters: DashboardFilters) {
  const period = buildDashboardQueryPeriod(filters);
  const sellerId = filters.sellerId;

  const [
    employees,
    budgetsSummary,
    budgetDailyTotal,
    budgetDailyWon,
    budgetDailyOpen,
    budgetDailyLost,
    budgetChannelDaily,
    budgetChannelAbandonment,
    salesSummary,
    salesDailyTotal,
    salesDailyCanceled,
    salesChannelDaily,
    salesTicketAverage,
  ] = await Promise.all([
    getSinapseJson<EmployeeSummary[]>("/companies/current/employees"),
    getSinapseJson<BudgetSummaryResponse>("/kpis/budgets/summary", {
      ...period,
      sellerId,
    }),
    getSinapseJson<BudgetDailyResponse>("/kpis/budgets/daily", {
      ...period,
      sellerId,
    }),
    getSinapseJson<BudgetDailyResponse>("/kpis/budgets/daily", {
      ...period,
      sellerId,
      status: getBudgetCardDefinition("won-budgets").query.status,
    }),
    getSinapseJson<BudgetDailyResponse>("/kpis/budgets/daily", {
      ...period,
      sellerId,
      status: getBudgetCardDefinition("open-budgets").query.status,
    }),
    getSinapseJson<BudgetDailyResponse>("/kpis/budgets/daily", {
      ...period,
      sellerId,
      status: getBudgetCardDefinition("lost-budgets").query.status,
    }),
    getSinapseJson<BudgetChannelDailyResponse>("/kpis/budgets/channel/daily", {
      ...period,
      sellerId,
    }),
    getSinapseJson<BudgetChannelAbandonmentResponse>("/kpis/budgets/channel/abandonment", {
      ...period,
      sellerId,
    }),
    getSinapseJson<SalesSummaryResponse>("/kpis/sales/summary", {
      ...period,
      sellerId,
    }),
    getSinapseJson<SalesDailyResponse>("/kpis/sales/daily", {
      ...period,
      sellerId,
    }),
    getSinapseJson<SalesDailyResponse>("/kpis/sales/daily", {
      ...period,
      sellerId,
      status: getSalesCardDefinition("canceled-sales").query.status,
    }),
    getSinapseJson<SalesChannelDailyResponse>("/kpis/sales/channel/daily", {
      ...period,
      sellerId,
    }),
    getSinapseJson<SalesTicketAverageResponse>("/kpis/sales/ticket-average", {
      ...period,
      sellerId,
      status: getSalesCardDefinition("ticket-average-sales").query.status,
    }),
  ]);

  return buildLiveDashboardViewModel({
    filters,
    employees,
    budgetsSummary,
    budgetDailyTotal,
    budgetDailyWon,
    budgetDailyOpen,
    budgetDailyLost,
    budgetChannelDaily,
    budgetChannelAbandonment,
    salesSummary,
    salesDailyTotal,
    salesDailyCanceled,
    salesChannelDaily,
    salesTicketAverage,
  });
}

export function buildLiveDashboardViewModel(input: LiveDashboardDataInput): LiveDashboardViewModel {
  const periodLabel = buildPeriodLabel(input.filters);
  const sellerLabel = buildSellerLabel(input.filters, input.employees);

  return {
    filters: input.filters,
    sellerOptions: input.employees.map(toEmployeeOption),
    sections: {
      budgets: buildBudgetSection(input, periodLabel, sellerLabel),
      sales: buildSalesSection(input, periodLabel, sellerLabel),
    },
  };
}

function buildBudgetSection(
  input: LiveDashboardDataInput,
  periodLabel: string,
  sellerLabel: string,
): DashboardCategorySection {
  const budgetChannelMetrics = collapseChannelRows(input.budgetChannelDaily.rows);
  const abandonmentMetrics = input.budgetChannelAbandonment.rows.map((row) => ({
    label: row.orderType,
    value: `${formatCount(row.count)} | ${formatCurrency(row.value)}`,
  }));

  return {
    title: "Orcamentos",
    description: "Leitura do volume gerado e do que virou ganho, aberto ou perdido no periodo.",
    cards: [
      {
        id: "total-budgets",
        label: "Orcamento total",
        amount: formatCurrency(input.budgetsSummary.total.value),
        quantityLabel: `Quantidade: ${formatCount(input.budgetsSummary.total.count)}`,
        tone: "navy",
        modal: {
          title: getBudgetCardDefinition("total-budgets").modalTitle,
          periodLabel,
          sellerLabel,
          countLabel: formatCount(input.budgetsSummary.total.count),
          valueLabel: formatCurrency(input.budgetsSummary.total.value),
          dailySeries: mapSeries(input.budgetDailyTotal.series),
          channelBreakdown: budgetChannelMetrics,
        },
      },
      {
        id: "won-budgets",
        label: "Orcamentos ganhos",
        amount: formatCurrency(input.budgetsSummary.won.value),
        quantityLabel: `Quantidade: ${formatCount(input.budgetsSummary.won.count)}`,
        tone: "success",
        modal: {
          title: getBudgetCardDefinition("won-budgets").modalTitle,
          periodLabel,
          sellerLabel,
          countLabel: formatCount(input.budgetsSummary.won.count),
          valueLabel: formatCurrency(input.budgetsSummary.won.value),
          dailySeries: mapSeries(input.budgetDailyWon.series),
          channelBreakdown: budgetChannelMetrics,
        },
      },
      {
        id: "open-budgets",
        label: "Orcamentos em aberto",
        amount: formatCurrency(input.budgetsSummary.open.value),
        quantityLabel: `Quantidade: ${formatCount(input.budgetsSummary.open.count)}`,
        tone: "accent",
        modal: {
          title: getBudgetCardDefinition("open-budgets").modalTitle,
          periodLabel,
          sellerLabel,
          countLabel: formatCount(input.budgetsSummary.open.count),
          valueLabel: formatCurrency(input.budgetsSummary.open.value),
          dailySeries: mapSeries(input.budgetDailyOpen.series),
          channelBreakdown: budgetChannelMetrics,
        },
      },
      {
        id: "lost-budgets",
        label: "Orcamentos perdidos",
        amount: formatCurrency(input.budgetsSummary.lost.value),
        quantityLabel: `Quantidade: ${formatCount(input.budgetsSummary.lost.count)}`,
        tone: "danger",
        modal: {
          title: getBudgetCardDefinition("lost-budgets").modalTitle,
          periodLabel,
          sellerLabel,
          countLabel: formatCount(input.budgetsSummary.lost.count),
          valueLabel: formatCurrency(input.budgetsSummary.lost.value),
          dailySeries: mapSeries(input.budgetDailyLost.series),
          channelBreakdown: abandonmentMetrics.map((metric) => ({
            label: metric.label,
            count: 0,
            value: metric.value,
          })),
        },
      },
    ],
    chartTitle: "Orcamentos por dia",
    chartDescription: "Serie consolidada do periodo atual com a mesma base do card principal.",
    chartSeries: mapSeries(input.budgetDailyTotal.series),
    sideTitle: "Abandono por canal",
    sideMetrics: abandonmentMetrics,
  };
}

function buildSalesSection(
  input: LiveDashboardDataInput,
  periodLabel: string,
  sellerLabel: string,
): DashboardCategorySection {
  const channelMetrics = input.salesTicketAverage.channels.map((row) => ({
    label: row.orderType,
    value: formatCurrency(row.averageTicket),
  }));

  return {
    title: "Vendas",
    description: "Volume vendido, cancelamentos e ticket medio real por canal e por periodo.",
    cards: [
      {
        id: "total-sales",
        label: "Vendas totais",
        amount: formatCurrency(input.salesSummary.total.value),
        quantityLabel: `Quantidade: ${formatCount(input.salesSummary.total.count)}`,
        tone: "navy",
        modal: {
          title: getSalesCardDefinition("total-sales").modalTitle,
          periodLabel,
          sellerLabel,
          countLabel: formatCount(input.salesSummary.total.count),
          valueLabel: formatCurrency(input.salesSummary.total.value),
          dailySeries: mapSeries(input.salesDailyTotal.series),
          channelBreakdown: collapseChannelRows(input.salesChannelDaily.rows),
        },
      },
      {
        id: "canceled-sales",
        label: "Vendas canceladas",
        amount: formatCurrency(input.salesSummary.canceled.value),
        quantityLabel: `Quantidade: ${formatCount(input.salesSummary.canceled.count)}`,
        tone: "danger",
        modal: {
          title: getSalesCardDefinition("canceled-sales").modalTitle,
          periodLabel,
          sellerLabel,
          countLabel: formatCount(input.salesSummary.canceled.count),
          valueLabel: formatCurrency(input.salesSummary.canceled.value),
          dailySeries: mapSeries(input.salesDailyCanceled.series),
        },
      },
      {
        id: "ticket-average-sales",
        label: "Ticket medio",
        amount: formatCurrency(input.salesTicketAverage.overall.averageTicket),
        quantityLabel: `Quantidade: ${formatCount(input.salesTicketAverage.overall.count)}`,
        tone: "accent",
        modal: {
          title: getSalesCardDefinition("ticket-average-sales").modalTitle,
          periodLabel,
          sellerLabel,
          countLabel: formatCount(input.salesTicketAverage.overall.count),
          valueLabel: formatCurrency(input.salesTicketAverage.overall.averageTicket),
          dailySeries: mapSeries(input.salesDailyTotal.series),
          channelBreakdown: input.salesTicketAverage.channels.map((channel) => ({
            label: channel.orderType,
            count: channel.count,
            value: formatCurrency(channel.averageTicket),
          })),
        },
      },
    ],
    chartTitle: "Vendas por dia por canal",
    chartDescription: "Serie consolidada com apoio da distribuicao por canal no mesmo periodo.",
    chartSeries: mapSeries(input.salesDailyTotal.series),
    sideTitle: "Ticket medio por canal",
    sideMetrics: channelMetrics,
  };
}

function mapSeries(series: Array<{ date: string; count: number; value: string }>): LiveKpiSeriesPoint[] {
  return series.map((point) => ({
    date: point.date,
    count: point.count,
    value: formatCurrency(point.value),
  }));
}

function collapseChannelRows(
  rows: Array<{ orderType: string; count: number; value: string } | { date: string; orderType: string; count: number; value: string }>,
): LiveKpiChannelPoint[] {
  const grouped = new Map<string, { count: number; value: number }>();

  for (const row of rows) {
    const current = grouped.get(row.orderType) ?? { count: 0, value: 0 };
    grouped.set(row.orderType, {
      count: current.count + row.count,
      value: current.value + Number.parseFloat(row.value),
    });
  }

  return [...grouped.entries()].map(([label, metric]) => ({
    label,
    count: metric.count,
    value: formatCurrency(metric.value),
  }));
}

function toEmployeeOption(employee: EmployeeSummary): EmployeeOption {
  return {
    label: employee.name,
    value: String(employee.id),
  };
}

function buildSellerLabel(filters: DashboardFilters, employees: EmployeeSummary[]) {
  if (filters.sellerId === undefined) {
    return "Todos os vendedores";
  }

  return employees.find((employee) => employee.id === filters.sellerId)?.name ?? `Seller ${filters.sellerId}`;
}

function buildPeriodLabel(filters: DashboardFilters) {
  if (filters.mode === "range") {
    return `${filters.from} -> ${filters.to}`;
  }

  return `${String(filters.month).padStart(2, "0")}/${filters.year}`;
}

function formatCurrency(value: string | number) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

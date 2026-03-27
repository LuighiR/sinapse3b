import { buildLiveDashboardViewModel } from "@/lib/dashboard-live-data";
import type { DashboardFilters } from "@/types/dashboard-filters";

describe("buildLiveDashboardViewModel", () => {
  it("creates separate budget and sales sections from live api responses", () => {
    const filters: DashboardFilters = {
      mode: "month",
      month: 1,
      year: 2026,
      sellerId: 500,
    };

    const viewModel = buildLiveDashboardViewModel({
      filters,
      employees: [
        {
          id: 7,
          erpId: 500,
          name: "Maria",
          branchId: 1,
          extensionNumber: "",
          extensionUuid: "",
          chatId: "",
        },
      ],
      budgetsSummary: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        total: { count: 15500, value: "1862861.2300" },
        won: { count: 12000, value: "1652861.2300" },
        open: { count: 500, value: "10000.0000" },
        lost: { count: 3000, value: "10514.5800" },
      },
      budgetDailyTotal: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        series: [{ date: "2026-01-01", count: 15, value: "1500.0000" }],
      },
      budgetDailyWon: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        series: [{ date: "2026-01-01", count: 12, value: "1200.0000" }],
      },
      budgetDailyOpen: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        series: [{ date: "2026-01-01", count: 2, value: "200.0000" }],
      },
      budgetDailyLost: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        series: [{ date: "2026-01-01", count: 1, value: "100.0000" }],
      },
      budgetChannelDaily: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        rows: [{ date: "2026-01-01", orderType: "WhatsApp", count: 5, value: "500.0000" }],
      },
      budgetChannelAbandonment: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        rows: [{ orderType: "Ligacao", count: 2, value: "200.0000" }],
      },
      salesSummary: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        total: { count: 12500, value: "1655861.2300" },
        active: { count: 12150, value: "1640000.0000" },
        canceled: { count: 350, value: "15861.2300" },
        averageDaily: { count: "18.5000", value: "5412.0000" },
        averageTicket: { value: "1251.0000" },
      },
      salesDailyTotal: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        series: [{ date: "2026-01-01", count: 8, value: "800.0000" }],
      },
      salesDailyCanceled: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        series: [{ date: "2026-01-01", count: 1, value: "80.0000" }],
      },
      salesChannelDaily: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        rows: [{ date: "2026-01-01", orderType: "WhatsApp", count: 3, value: "300.0000" }],
      },
      salesTicketAverage: {
        period: { from: "2026-01-01", to: "2026-01-31", key: "2026-01-01:2026-01-31" },
        overall: { count: 12500, value: "1655861.2300", averageTicket: "132.4689" },
        channels: [
          { orderType: "WhatsApp", count: 7000, value: "720000.0000", averageTicket: "102.8571" },
        ],
      },
    });

    expect(viewModel.sections.budgets.cards.length).toBeGreaterThanOrEqual(4);
    expect(viewModel.sections.sales.cards.length).toBeGreaterThanOrEqual(3);
    expect(viewModel.sections.budgets.cards[0]?.label).toMatch(/orcamento/i);
    expect(viewModel.sections.sales.cards[0]?.label).toMatch(/vendas/i);
    expect(viewModel.sellerOptions).toEqual([{ label: "Maria", value: "500" }]);
    expect(viewModel.sections.budgets.cards[0]?.modal.sellerLabel).toBe("Maria");
  });
});

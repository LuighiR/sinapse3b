import { budgetDashboardMock } from "@/lib/mock-budget-data";

describe("budget dashboard mock data", () => {
  it("contains the KPI sections needed by the dashboard", () => {
    expect(budgetDashboardMock.summaryCards.length).toBeGreaterThanOrEqual(4);
    expect(budgetDashboardMock.dailyTrend.points.length).toBeGreaterThan(0);
    expect(budgetDashboardMock.statusBreakdown.items.length).toBeGreaterThan(0);
  });
});

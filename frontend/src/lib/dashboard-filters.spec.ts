import {
  buildDashboardQueryPeriod,
  parseDashboardFilters,
} from "@/lib/dashboard-filters";

describe("buildDashboardQueryPeriod", () => {
  it("converts month mode into backend from/to", () => {
    expect(
      buildDashboardQueryPeriod({
        mode: "month",
        month: 1,
        year: 2026,
        sellerId: undefined,
      }),
    ).toEqual({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("keeps exact dates in range mode", () => {
    expect(
      buildDashboardQueryPeriod({
        mode: "range",
        from: "2026-03-15",
        to: "2026-03-20",
        sellerId: undefined,
      }),
    ).toEqual({
      from: "2026-03-15",
      to: "2026-03-20",
    });
  });
});

describe("parseDashboardFilters", () => {
  it("defaults to the current month filter shape", () => {
    const filters = parseDashboardFilters({});

    expect(filters.mode).toBe("month");
    expect(filters.month).toBeGreaterThanOrEqual(1);
    expect(filters.month).toBeLessThanOrEqual(12);
    expect(filters.year).toBeGreaterThan(2020);
    expect(filters.sellerId).toBeUndefined();
  });

  it("reads sellerId and range mode from search params", () => {
    expect(
      parseDashboardFilters({
        mode: "range",
        from: "2026-03-15",
        to: "2026-03-20",
        sellerId: "7",
      }),
    ).toEqual({
      mode: "range",
      from: "2026-03-15",
      to: "2026-03-20",
      sellerId: 7,
    });
  });
});

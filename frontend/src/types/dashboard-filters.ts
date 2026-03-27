export type DashboardMonthFilter = {
  mode: "month";
  month: number;
  year: number;
  sellerId?: number;
};

export type DashboardRangeFilter = {
  mode: "range";
  from: string;
  to: string;
  sellerId?: number;
};

export type DashboardFilters = DashboardMonthFilter | DashboardRangeFilter;

export type DashboardQueryPeriod = {
  from: string;
  to: string;
};

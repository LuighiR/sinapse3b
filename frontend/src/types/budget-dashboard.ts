export type SummaryCard = {
  label: string;
  value: string;
  delta: string;
  tone: "navy" | "accent" | "success" | "neutral";
};

export type TrendPoint = {
  label: string;
  total: number;
};

export type BreakdownItem = {
  label: string;
  value: string;
  share: number;
};

export type ComparisonItem = {
  label: string;
  current: string;
  previous: string;
  change: string;
};

export type BudgetDashboardData = {
  summaryCards: SummaryCard[];
  dailyTrend: {
    title: string;
    subtitle: string;
    points: TrendPoint[];
  };
  statusBreakdown: {
    title: string;
    items: BreakdownItem[];
  };
  comparison: {
    title: string;
    items: ComparisonItem[];
  };
  highlight: {
    title: string;
    value: string;
    note: string;
  };
};

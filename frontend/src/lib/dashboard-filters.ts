import type {
  DashboardFilters,
  DashboardMonthFilter,
  DashboardQueryPeriod,
  DashboardRangeFilter,
} from "@/types/dashboard-filters";

type SearchParamValue = string | string[] | undefined;

type DashboardSearchParams = Record<string, SearchParamValue>;

export function parseDashboardFilters(searchParams: DashboardSearchParams): DashboardFilters {
  const sellerId = parseSellerId(searchParams.sellerId);
  const mode = getFirst(searchParams.mode);

  if (mode === "range") {
    const from = getFirst(searchParams.from);
    const to = getFirst(searchParams.to);

    if (from && to) {
      return {
        mode: "range",
        from,
        to,
        sellerId,
      };
    }
  }

  const now = new Date();
  const month = parsePositiveInt(getFirst(searchParams.month)) ?? now.getMonth() + 1;
  const year = parsePositiveInt(getFirst(searchParams.year)) ?? now.getFullYear();

  return {
    mode: "month",
    month: clampMonth(month),
    year,
    sellerId,
  };
}

export function buildDashboardQueryPeriod(filters: DashboardFilters): DashboardQueryPeriod {
  if (filters.mode === "range") {
    return {
      from: filters.from,
      to: filters.to,
    };
  }

  const from = new Date(Date.UTC(filters.year, filters.month - 1, 1));
  const to = new Date(Date.UTC(filters.year, filters.month, 0));

  return {
    from: formatDateKey(from),
    to: formatDateKey(to),
  };
}

export function toDashboardSearchParams(filters: DashboardFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.mode === "month") {
    params.set("mode", "month");
    params.set("month", String(filters.month));
    params.set("year", String(filters.year));
  } else {
    params.set("mode", "range");
    params.set("from", filters.from);
    params.set("to", filters.to);
  }

  if (filters.sellerId !== undefined) {
    params.set("sellerId", String(filters.sellerId));
  }

  return params;
}

export function withSellerFilter<T extends DashboardMonthFilter | DashboardRangeFilter>(
  filters: T,
  sellerId?: number,
): T {
  return {
    ...filters,
    sellerId,
  };
}

function getFirst(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseSellerId(value: SearchParamValue) {
  return parsePositiveInt(getFirst(value));
}

function clampMonth(month: number) {
  if (month < 1) {
    return 1;
  }

  if (month > 12) {
    return 12;
  }

  return month;
}

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

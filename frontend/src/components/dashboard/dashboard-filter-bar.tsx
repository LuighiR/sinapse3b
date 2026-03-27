"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { toDashboardSearchParams } from "@/lib/dashboard-filters";
import type { DashboardFilters } from "@/types/dashboard-filters";
import type { EmployeeOption } from "@/types/live-kpi-dashboard";

type DashboardFilterBarProps = {
  filters: DashboardFilters;
  sellerOptions: EmployeeOption[];
};

type DraftFilters = {
  mode: "month" | "range";
  month: number;
  year: number;
  from: string;
  to: string;
  sellerId: string;
};

const monthLabels = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function DashboardFilterBar({
  filters,
  sellerOptions,
}: DashboardFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DraftFilters>(() => toDraftFilters(filters));

  useEffect(() => {
    setDraft(toDraftFilters(filters));
  }, [filters]);

  function applyFilters() {
    const nextFilters =
      draft.mode === "month"
        ? {
            mode: "month" as const,
            month: draft.month,
            year: draft.year,
            sellerId: parseSellerId(draft.sellerId),
          }
        : {
            mode: "range" as const,
            from: draft.from,
            to: draft.to,
            sellerId: parseSellerId(draft.sellerId),
          };

    const params = toDashboardSearchParams(nextFilters);

    startTransition(() => {
      router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  return (
    <div className="rounded-[22px] border border-[color:var(--color-line)] bg-[var(--color-paper)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Periodo
          </div>
          <button
            aria-pressed={draft.mode === "month"}
            className={cn(
              "inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold transition",
              draft.mode === "month"
                ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-paper)]"
                : "border-[color:var(--color-line)] bg-white text-[var(--color-ink)]",
            )}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                mode: "month",
              }))
            }
            type="button"
          >
            Mes
          </button>
          <button
            aria-pressed={draft.mode === "range"}
            className={cn(
              "inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold transition",
              draft.mode === "range"
                ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-[var(--color-paper)]"
                : "border-[color:var(--color-line)] bg-white text-[var(--color-ink)]",
            )}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                mode: "range",
              }))
            }
            type="button"
          >
            Range
          </button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
          {draft.mode === "month" ? (
            <>
              <label className="text-sm">
                <span className="mb-2 block font-medium text-[var(--color-muted)]">Mes</span>
                <select
                  className="h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 text-sm outline-none"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      month: Number.parseInt(event.target.value, 10),
                    }))
                  }
                  value={draft.month}
                >
                  {monthLabels.map((monthLabel, index) => (
                    <option key={monthLabel} value={index + 1}>
                      {monthLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-2 block font-medium text-[var(--color-muted)]">Ano</span>
                <select
                  className="h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 text-sm outline-none"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      year: Number.parseInt(event.target.value, 10),
                    }))
                  }
                  value={draft.year}
                >
                  {buildYearOptions(draft.year).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="text-sm">
                <span className="mb-2 block font-medium text-[var(--color-muted)]">De</span>
                <input
                  className="h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 text-sm outline-none"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      from: event.target.value,
                    }))
                  }
                  type="date"
                  value={draft.from}
                />
              </label>

              <label className="text-sm">
                <span className="mb-2 block font-medium text-[var(--color-muted)]">Ate</span>
                <input
                  className="h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 text-sm outline-none"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      to: event.target.value,
                    }))
                  }
                  type="date"
                  value={draft.to}
                />
              </label>
            </>
          )}

          <label className="text-sm">
            <span className="mb-2 block font-medium text-[var(--color-muted)]">Seller</span>
            <select
              className="h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-4 text-sm outline-none"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sellerId: event.target.value,
                }))
              }
              value={draft.sellerId}
            >
              <option value="">Todos</option>
              {sellerOptions.map((seller) => (
                <option key={seller.value} value={seller.value}>
                  {seller.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <Button className="w-full lg:w-auto" disabled={isPending} onClick={applyFilters}>
              {isPending ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function toDraftFilters(filters: DashboardFilters): DraftFilters {
  if (filters.mode === "month") {
    const monthDate = `${filters.year}-${String(filters.month).padStart(2, "0")}-01`;

    return {
      mode: "month",
      month: filters.month,
      year: filters.year,
      from: monthDate,
      to: monthDate,
      sellerId: filters.sellerId === undefined ? "" : String(filters.sellerId),
    };
  }

  const date = new Date(`${filters.from}T00:00:00`);

  return {
    mode: "range",
    month: Number.isNaN(date.getTime()) ? 1 : date.getMonth() + 1,
    year: Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear(),
    from: filters.from,
    to: filters.to,
    sellerId: filters.sellerId === undefined ? "" : String(filters.sellerId),
  };
}

function buildYearOptions(currentYear: number) {
  return Array.from({ length: 5 }, (_, index) => currentYear - 1 + index);
}

function parseSellerId(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

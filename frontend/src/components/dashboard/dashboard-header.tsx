import { Badge } from "@/components/ui/badge";
import { DashboardFilterBar } from "@/components/dashboard/dashboard-filter-bar";
import type { DashboardFilters } from "@/types/dashboard-filters";
import type { EmployeeOption } from "@/types/live-kpi-dashboard";

type DashboardHeaderProps = {
  filters: DashboardFilters;
  sellerOptions: EmployeeOption[];
};

export function DashboardHeader({
  filters,
  sellerOptions,
}: DashboardHeaderProps) {
  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Badge>cockpit</Badge>
          <h1 className="mt-4 text-4xl leading-[0.96] text-[var(--color-ink)]">
            Cockpit executivo ao vivo.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
            Um unico recorte de data e seller para ler orcamentos e vendas com
            consistencia, sem perder o drilldown por KPI.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
          <div className="rounded-2xl border border-[color:var(--color-line)] bg-[var(--color-paper)] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Leitura
            </div>
            <div className="mt-2 text-lg font-semibold text-[var(--color-ink)]">Dados ao vivo</div>
          </div>
          <div className="rounded-2xl border border-[color:var(--color-line)] bg-[var(--color-paper)] px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Filtro
            </div>
            <div className="mt-2 text-lg font-semibold text-[var(--color-ink)]">
              Data e seller
            </div>
          </div>
        </div>
      </div>
      <DashboardFilterBar filters={filters} sellerOptions={sellerOptions} />
    </header>
  );
}

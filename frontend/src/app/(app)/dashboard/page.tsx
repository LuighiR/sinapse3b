import { DashboardConnectionState } from "@/components/dashboard/dashboard-connection-state";
import { LiveDashboard } from "@/components/dashboard/live-dashboard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { parseDashboardFilters } from "@/lib/dashboard-filters";
import { getLiveDashboardData } from "@/lib/dashboard-live-data";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const filters = parseDashboardFilters(searchParams ? await searchParams : {});
  const result = await loadDashboardResult(filters);

  if ("detail" in result) {
    return (
      <DashboardShell>
        <DashboardConnectionState detail={result.detail} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <LiveDashboard viewModel={result.viewModel} />
    </DashboardShell>
  );
}

async function loadDashboardResult(filters: ReturnType<typeof parseDashboardFilters>) {
  try {
    return {
      viewModel: await getLiveDashboardData(filters),
    };
  } catch (error) {
    return {
      detail:
        error instanceof Error
          ? error.message
          : "Falha desconhecida ao carregar o cockpit.",
    };
  }
}

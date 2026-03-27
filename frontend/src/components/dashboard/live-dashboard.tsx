"use client";

import { useState } from "react";

import { DashboardCategorySection } from "@/components/dashboard/dashboard-category-section";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KpiDetailModal } from "@/components/dashboard/kpi-detail-modal";
import type { LiveDashboardViewModel, LiveKpiCard } from "@/types/live-kpi-dashboard";

export function LiveDashboard({ viewModel }: { viewModel: LiveDashboardViewModel }) {
  const [activeCard, setActiveCard] = useState<LiveKpiCard | null>(null);

  return (
    <div className="space-y-8">
      <DashboardHeader
        filters={viewModel.filters}
        sellerOptions={viewModel.sellerOptions}
      />

      <DashboardCategorySection
        onOpenCard={setActiveCard}
        section={viewModel.sections.budgets}
      />

      <DashboardCategorySection
        onOpenCard={setActiveCard}
        section={viewModel.sections.sales}
      />

      {activeCard ? (
        <KpiDetailModal card={activeCard} onClose={() => setActiveCard(null)} />
      ) : null}
    </div>
  );
}

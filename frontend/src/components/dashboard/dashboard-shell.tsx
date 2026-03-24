import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <DashboardSidebar />
        <div className="space-y-6 rounded-[var(--radius-shell)] bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(241,239,232,0.76))] p-5 shadow-[var(--shadow-panel)] backdrop-blur-md md:p-7">
          <DashboardHeader />
          {children}
        </div>
      </div>
    </section>
  );
}

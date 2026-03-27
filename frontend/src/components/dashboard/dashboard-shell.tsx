import type { ReactNode } from "react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[1720px] px-6 py-8 lg:px-10">
      <div className="grid w-full gap-5 xl:grid-cols-[292px_minmax(0,1fr)]">
        <DashboardSidebar />
        <div className="space-y-6 rounded-[28px] border border-[color:rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.9)] p-6 shadow-[var(--shadow-panel)] md:p-7">
          {children}
        </div>
      </div>
    </section>
  );
}

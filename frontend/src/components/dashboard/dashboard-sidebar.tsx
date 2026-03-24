import { SinapseHubLogo } from "@/components/ui/sinapse-hub-logo";
import { cn } from "@/lib/cn";

const navItems = [
  { label: "Dashboard", active: true },
  { label: "Analytics", active: false },
  { label: "Operacao", active: false },
  { label: "Relatorios", active: false },
];

export function DashboardSidebar() {
  return (
    <aside className="flex flex-col rounded-[var(--radius-shell)] bg-[linear-gradient(180deg,#181820_0%,#202048_100%)] p-5 text-[var(--color-paper)] shadow-[var(--shadow-panel)]">
      <SinapseHubLogo compact className="text-[var(--color-paper)]" />

      <div className="mt-10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:rgba(241,239,232,0.54)]">
          navegacao
        </div>
        <nav className="mt-5 space-y-2">
          {navItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-3 text-sm text-[color:rgba(241,239,232,0.7)] transition",
                item.active && "bg-white/12 text-[var(--color-paper)]",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-current opacity-70" />
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-auto rounded-[24px] border border-white/8 bg-white/6 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-[color:rgba(241,239,232,0.54)]">
          sessao
        </div>
        <div className="mt-3 text-sm font-semibold">Equipe Comercial</div>
        <div className="mt-1 text-sm text-[color:rgba(241,239,232,0.64)]">
          camada operacional inicial
        </div>
      </div>
    </aside>
  );
}

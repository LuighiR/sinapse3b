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
    <aside className="flex flex-col rounded-[28px] border border-[color:rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,#16161E_0%,#1B1D2D_50%,#202048_100%)] p-5 text-[var(--color-paper)] shadow-[var(--shadow-panel)]">
      <SinapseHubLogo compact className="text-[var(--color-paper)]" />

      <div className="mt-8 rounded-2xl border border-white/8 bg-white/5 px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:rgba(241,239,232,0.5)]">
          workspace
        </div>
        <div className="mt-3 text-lg font-semibold">Cockpit executivo</div>
        <div className="mt-1 text-sm text-[color:rgba(241,239,232,0.64)]">
          orcamentos, vendas e performance comercial
        </div>
      </div>

      <div className="mt-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:rgba(241,239,232,0.48)]">
          navegacao
        </div>
        <nav className="mt-4 space-y-2">
          {navItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm text-[color:rgba(241,239,232,0.68)] transition",
                item.active && "border-white/8 bg-white/10 text-[var(--color-paper)]",
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-current opacity-70" />
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-auto rounded-[20px] border border-white/8 bg-white/6 p-4">
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

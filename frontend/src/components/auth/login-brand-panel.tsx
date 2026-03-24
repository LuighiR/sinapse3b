import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SinapseHubLogo } from "@/components/ui/sinapse-hub-logo";

const floatingMetrics = [
  { title: "Conversao", value: "72%", note: "orcamentos ganhos" },
  { title: "Ticket medio", value: "R$ 2,8k", note: "ultimos 30 dias" },
  { title: "Tempo", value: "24h", note: "resposta comercial" },
];

export function LoginBrandPanel() {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-shell)] bg-[linear-gradient(160deg,#16161E_0%,#202048_60%,#23235A_100%)] px-7 py-8 text-[var(--color-paper)] shadow-[var(--shadow-panel)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_32%),radial-gradient(circle_at_70%_48%,rgba(111,134,255,0.24),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_28%)]" />
      <div className="relative flex h-full flex-col">
        <SinapseHubLogo className="text-[var(--color-paper)]" />
        <div className="mt-10 max-w-md">
          <Badge className="bg-white/12 text-[var(--color-paper)]">budget cockpit</Badge>
          <h1 className="mt-5 text-5xl leading-[0.92] text-balance">
            Bem-vindo de volta ao cockpit da Sinapse.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-[color:rgba(241,239,232,0.74)]">
            Uma entrada institucional para chegar rapido aos indicadores de orcamentos,
            comparativos e sinais de performance comercial.
          </p>
        </div>

        <div className="relative mt-10 flex-1">
          <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 shadow-[0_0_0_28px_rgba(255,255,255,0.03),0_0_0_56px_rgba(255,255,255,0.02)]" />
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(111,134,255,0.34),rgba(255,255,255,0.04)_70%,transparent_100%)] blur-md" />

          <Card className="absolute left-0 top-4 w-40 bg-white/92 p-4 text-[var(--color-ink)]">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Orcamentos
            </span>
            <div className="mt-3 text-3xl font-semibold">72%</div>
            <div className="mt-3 h-16 rounded-full border-[10px] border-[color:rgba(22,22,30,0.08)] border-b-0 relative overflow-hidden">
              <div className="absolute inset-0 rounded-full border-[10px] border-transparent border-t-[var(--color-navy)] border-l-[var(--color-accent)] -rotate-[18deg]" />
            </div>
          </Card>

          <Card className="absolute right-8 top-10 w-44 bg-white/92 p-4 text-[var(--color-ink)]">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Progresso
            </span>
            <div className="mt-4 space-y-2">
              {floatingMetrics.map((metric) => (
                <div key={metric.title} className="flex items-center justify-between gap-3 text-sm">
                  <span>{metric.title}</span>
                  <span className="font-semibold">{metric.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="absolute bottom-6 left-5 w-36 bg-white/92 p-4 text-[var(--color-ink)]">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Pipeline
            </span>
            <div className="mt-3 text-3xl font-semibold">35.05</div>
            <div className="mt-3 flex h-12 items-end gap-2">
              <div className="w-3 rounded-full bg-[var(--color-accent)]/60" style={{ height: "45%" }} />
              <div className="w-3 rounded-full bg-[var(--color-navy)]" style={{ height: "88%" }} />
              <div className="w-3 rounded-full bg-[var(--color-success)]" style={{ height: "62%" }} />
              <div className="w-3 rounded-full bg-[var(--color-accent)]/70" style={{ height: "76%" }} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

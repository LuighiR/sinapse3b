import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SinapseHubLogo } from "@/components/ui/sinapse-hub-logo";

const highlightMetrics = [
  { title: "Conversao", value: "72%", note: "orcamentos ganhos" },
  { title: "Ticket medio", value: "R$ 2,8 mil", note: "ultimos 30 dias" },
  { title: "Tempo medio", value: "24h", note: "retorno comercial" },
];

export function LoginBrandPanel() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[color:rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,#171720_0%,#1C1E34_48%,#202048_100%)] px-8 py-8 text-[var(--color-paper)] shadow-[var(--shadow-panel)]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%,rgba(255,255,255,0.02)_100%)]" />
      <div className="absolute inset-y-0 right-0 w-[44%] border-l border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />

      <div className="relative flex h-full flex-col">
        <SinapseHubLogo className="text-[var(--color-paper)]" />

        <div className="mt-12 max-w-xl">
          <Badge className="bg-white/8 text-[var(--color-paper)]">executive workspace</Badge>
          <h1 className="mt-5 text-[clamp(2.8rem,4vw,4.25rem)] leading-[0.96] text-balance">
            Gestao comercial com leitura clara, diaria e executiva.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-[color:rgba(247,248,251,0.72)]">
            Uma entrada unica para acompanhar orcamentos, vendas e operacao com
            consistencia visual de produto, sem parecer prototipo.
          </p>
        </div>

        <div className="mt-10 grid flex-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_260px]">
          <Card className="border-white/8 bg-white/6 p-6 text-[var(--color-paper)] shadow-none">
            <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:rgba(247,248,251,0.5)]">
                  Panorama do workspace
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  Budget cockpit
                </div>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/6 px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:rgba(247,248,251,0.5)]">
                  Receita
                </div>
                <div className="mt-1 text-xl font-semibold">R$ 1,86 mi</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {highlightMetrics.map((metric) => (
                <div
                  key={metric.title}
                  className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.04)] px-4 py-4"
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[color:rgba(247,248,251,0.52)]">
                    {metric.title}
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
                    {metric.value}
                  </div>
                  <div className="mt-2 text-sm text-[color:rgba(247,248,251,0.62)]">
                    {metric.note}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-4">
              <div className="flex items-end gap-3">
                {[44, 58, 52, 67, 74, 69, 82, 76, 88].map((height, index) => (
                  <div key={`${height}-${index}`} className="flex flex-1 flex-col gap-2">
                    <div className="flex h-24 items-end rounded-md bg-white/4 px-1.5 py-1">
                      <div
                        className={`w-full rounded-sm ${index > 5 ? "bg-white/85" : "bg-[rgba(111,134,255,0.78)]"}`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <div className="text-center text-[10px] uppercase tracking-[0.16em] text-[color:rgba(247,248,251,0.42)]">
                      S{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-5">
            <Card className="border-white/8 bg-white/6 p-5 text-[var(--color-paper)] shadow-none">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:rgba(247,248,251,0.5)]">
                Destaque do dia
              </div>
              <div className="mt-3 text-4xl font-semibold tracking-[-0.06em]">35,05</div>
              <div className="mt-2 text-sm text-[color:rgba(247,248,251,0.64)]">
                oportunidades em andamento
              </div>
            </Card>

            <Card className="border-white/8 bg-white/6 p-5 text-[var(--color-paper)] shadow-none">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:rgba(247,248,251,0.5)]">
                Leitura esperada
              </div>
              <div className="mt-4 space-y-3 text-sm text-[color:rgba(247,248,251,0.72)]">
                <div className="flex items-center justify-between gap-3">
                  <span>Orcamentos por periodo</span>
                  <span className="font-semibold text-white">Diario</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Vendas por seller</span>
                  <span className="font-semibold text-white">Ao vivo</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Drilldown por KPI</span>
                  <span className="font-semibold text-white">Detalhado</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

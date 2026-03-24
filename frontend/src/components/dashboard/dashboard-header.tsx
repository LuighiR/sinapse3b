import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DashboardHeader() {
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Badge>cockpit</Badge>
        <h1 className="mt-4 text-5xl leading-[0.92] text-[var(--color-ink)]">
          Orcamentos em modo executivo.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          Leitura rapida da saude comercial com foco em ganho, ritmo e comparativos
          essenciais para tomada de decisao.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary">Ultimos 30 dias</Button>
        <Button variant="secondary">Todos vendedores</Button>
        <Button variant="secondary">Status misto</Button>
      </div>
    </header>
  );
}

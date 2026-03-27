import { Badge } from "@/components/ui/badge";

type DashboardConnectionStateProps = {
  detail?: string;
};

export function DashboardConnectionState({
  detail,
}: DashboardConnectionStateProps) {
  const isUnauthorized = detail?.includes("401");
  const isMissingEnv = detail?.includes("Missing required frontend env");

  const title = isUnauthorized
    ? "Conecte o cockpit ao backend"
    : "Ainda nao foi possivel carregar os KPIs";
  const description = isUnauthorized
    ? "O frontend chegou a dashboard, mas o backend recusou as credenciais de desenvolvimento."
    : "O dashboard ficou de pe porque a estrutura esta certa, mas precisamos alinhar a conexao com a API para liberar os indicadores.";
  const hint = isMissingEnv
    ? "Preencha SINAPSE_API_BASE_URL, SINAPSE_DEV_JWT e SINAPSE_DEV_TENANT_ID no arquivo frontend/.env.local."
    : "Revise o JWT de desenvolvimento, o tenant atual e a URL configurada em frontend/.env.local.";

  return (
    <section className="rounded-[var(--radius-shell)] border border-[color:rgba(32,32,72,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(241,239,232,0.96))] p-8 shadow-[var(--shadow-card)]">
      <Badge>conexao</Badge>
      <h1 className="mt-4 text-4xl leading-[0.96] text-[var(--color-ink)]">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
        {description}
      </p>
      <div className="mt-6 rounded-[var(--radius-card)] border border-[color:rgba(32,32,72,0.12)] bg-[color:rgba(32,32,72,0.04)] p-5">
        <p className="text-sm font-semibold text-[var(--color-ink)]">{hint}</p>
        {detail ? (
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            Detalhe retornado: {detail}
          </p>
        ) : null}
      </div>
    </section>
  );
}

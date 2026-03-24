import type { BudgetDashboardData } from "@/types/budget-dashboard";

export const budgetDashboardMock: BudgetDashboardData = {
  summaryCards: [
    { label: "Volume gerado", value: "1.248", delta: "+12.4%", tone: "navy" },
    { label: "Taxa de ganho", value: "72%", delta: "+4.1%", tone: "accent" },
    { label: "Ticket medio", value: "R$ 2,8k", delta: "+9.8%", tone: "success" },
    { label: "Ciclo medio", value: "3.8 dias", delta: "-6.2%", tone: "neutral" },
  ],
  dailyTrend: {
    title: "Evolucao diaria do pipeline",
    subtitle: "Ultimos 7 dias com foco em ganho e ritmo comercial",
    points: [
      { label: "Seg", total: 112 },
      { label: "Ter", total: 136 },
      { label: "Qua", total: 124 },
      { label: "Qui", total: 158 },
      { label: "Sex", total: 174 },
      { label: "Sab", total: 102 },
      { label: "Dom", total: 88 },
    ],
  },
  statusBreakdown: {
    title: "Distribuicao por status",
    items: [
      { label: "Ganhos", value: "436", share: 72 },
      { label: "Pendentes", value: "228", share: 38 },
      { label: "Perdidos", value: "144", share: 22 },
    ],
  },
  comparison: {
    title: "Comparativo por frente comercial",
    items: [
      { label: "Televendas", current: "R$ 320k", previous: "R$ 271k", change: "+18%" },
      { label: "Balcao", current: "R$ 184k", previous: "R$ 162k", change: "+13%" },
      { label: "Representantes", current: "R$ 128k", previous: "R$ 119k", change: "+7%" },
    ],
  },
  highlight: {
    title: "Sinal executivo",
    value: "Ritmo acima da media",
    note: "A curva de ganho acelerou no fim da semana sem aumentar o ciclo medio de fechamento.",
  },
};

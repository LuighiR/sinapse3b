import { render, screen } from "@testing-library/react";

import { KpiDetailModal } from "@/components/dashboard/kpi-detail-modal";

describe("KpiDetailModal", () => {
  it("renders a tailored modal with active period and daily detail", () => {
    render(
      <KpiDetailModal
        card={{
          id: "total-budgets",
          label: "Orcamento total",
          amount: "R$ 1.862.861,23",
          quantityLabel: "Quantidade: 15.500",
          tone: "navy",
          modal: {
            title: "Orcamento total",
            periodLabel: "01/2026",
            sellerLabel: "Todos os vendedores",
            countLabel: "15.500",
            valueLabel: "R$ 1.862.861,23",
            dailySeries: [{ date: "2026-01-01", count: 10, value: "R$ 1.000,00" }],
            channelBreakdown: [{ label: "WhatsApp", count: 5, value: "R$ 500,00" }],
          },
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(/orcamento total/i)).toBeInTheDocument();
    expect(screen.getByText(/periodo ativo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/por dia/i)).toHaveLength(2);
    expect(screen.getByText(/whatsapp/i)).toBeInTheDocument();
  });
});

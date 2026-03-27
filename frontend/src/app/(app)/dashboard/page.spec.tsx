import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { getLiveDashboardData } from "@/lib/dashboard-live-data";
import DashboardPage from "./page";

vi.mock("@/lib/dashboard-live-data", () => ({
  getLiveDashboardData: vi.fn().mockResolvedValue({
    filters: {
      mode: "month",
      month: 1,
      year: 2026,
    },
    sellerOptions: [{ label: "Maria", value: "7" }],
    sections: {
      budgets: {
        title: "Orcamentos",
        description: "Leitura dos orcamentos no periodo.",
        chartTitle: "Orcamentos por dia",
        chartDescription: "Serie do periodo.",
        chartSeries: [{ date: "2026-01-01", count: 10, value: "R$ 1.000,00" }],
        sideTitle: "Abandono por canal",
        sideMetrics: [{ label: "WhatsApp", value: "R$ 250,00" }],
        cards: [
          {
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
            },
          },
        ],
      },
      sales: {
        title: "Vendas",
        description: "Leitura das vendas no periodo.",
        chartTitle: "Vendas por dia por canal",
        chartDescription: "Serie do periodo.",
        chartSeries: [{ date: "2026-01-01", count: 4, value: "R$ 800,00" }],
        sideTitle: "Ticket medio por canal",
        sideMetrics: [{ label: "Ligacao", value: "R$ 120,00" }],
        cards: [
          {
            id: "total-sales",
            label: "Vendas totais",
            amount: "R$ 1.655.861,23",
            quantityLabel: "Quantidade: 12.500",
            tone: "navy",
            modal: {
              title: "Vendas totais",
              periodLabel: "01/2026",
              sellerLabel: "Todos os vendedores",
              countLabel: "12.500",
              valueLabel: "R$ 1.655.861,23",
              dailySeries: [{ date: "2026-01-01", count: 4, value: "R$ 800,00" }],
            },
          },
        ],
      },
    },
  }),
}));

describe("DashboardPage", () => {
  it("renders the global month/range and seller filters", async () => {
    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("button", { name: /^Mes$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Range$/i })).toBeInTheDocument();
    expect(screen.getByText(/^Seller$/i)).toBeInTheDocument();
  });

  it("renders separate Orcamentos and Vendas sections", async () => {
    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: /^Orcamentos$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Vendas$/i })).toBeInTheDocument();
    expect(screen.getByText(/^Orcamento total$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Vendas totais$/i)).toBeInTheDocument();
  });

  it("shows a friendly auth state when the API rejects the dashboard request", async () => {
    vi.mocked(getLiveDashboardData).mockRejectedValueOnce(
      new Error("Sinapse API request failed: 401 Unauthorized"),
    );

    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: /conecte o cockpit ao backend/i })).toBeInTheDocument();
    expect(screen.getByText(/401 unauthorized/i)).toBeInTheDocument();
  });
});

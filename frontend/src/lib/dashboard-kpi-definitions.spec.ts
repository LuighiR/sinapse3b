import {
  getBudgetCardDefinition,
  getSalesCardDefinition,
} from "@/lib/dashboard-kpi-definitions";

describe("dashboard kpi definitions", () => {
  it("maps the canceled sales card to the correct sales status filter", () => {
    expect(getSalesCardDefinition("canceled-sales")).toMatchObject({
      query: {
        status: "Cancelada",
      },
    });
  });

  it("maps the won budgets card to the correct budget status filter", () => {
    expect(getBudgetCardDefinition("won-budgets")).toMatchObject({
      query: {
        status: "Baixado",
      },
    });
  });
});

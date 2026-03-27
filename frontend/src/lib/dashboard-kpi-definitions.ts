export type BudgetCardId =
  | "total-budgets"
  | "won-budgets"
  | "open-budgets"
  | "lost-budgets";

export type SalesCardId =
  | "total-sales"
  | "canceled-sales"
  | "ticket-average-sales";

export type BudgetCardDefinition = {
  id: BudgetCardId;
  label: string;
  modalTitle: string;
  query: {
    status?: "Cancelado" | "Baixado" | "Pendente";
  };
};

export type SalesCardDefinition = {
  id: SalesCardId;
  label: string;
  modalTitle: string;
  query: {
    status?: "Ativa" | "Cancelada";
  };
};

const budgetCardDefinitions: Record<BudgetCardId, BudgetCardDefinition> = {
  "total-budgets": {
    id: "total-budgets",
    label: "Orcamento total",
    modalTitle: "Orcamento total",
    query: {},
  },
  "won-budgets": {
    id: "won-budgets",
    label: "Orcamentos ganhos",
    modalTitle: "Orcamentos ganhos",
    query: {
      status: "Baixado",
    },
  },
  "open-budgets": {
    id: "open-budgets",
    label: "Orcamentos em aberto",
    modalTitle: "Orcamentos em aberto",
    query: {
      status: "Pendente",
    },
  },
  "lost-budgets": {
    id: "lost-budgets",
    label: "Orcamentos perdidos",
    modalTitle: "Orcamentos perdidos",
    query: {
      status: "Cancelado",
    },
  },
};

const salesCardDefinitions: Record<SalesCardId, SalesCardDefinition> = {
  "total-sales": {
    id: "total-sales",
    label: "Vendas totais",
    modalTitle: "Vendas totais",
    query: {},
  },
  "canceled-sales": {
    id: "canceled-sales",
    label: "Vendas canceladas",
    modalTitle: "Vendas canceladas",
    query: {
      status: "Cancelada",
    },
  },
  "ticket-average-sales": {
    id: "ticket-average-sales",
    label: "Ticket medio",
    modalTitle: "Ticket medio por venda",
    query: {
      status: "Ativa",
    },
  },
};

export function getBudgetCardDefinition(cardId: BudgetCardId) {
  return budgetCardDefinitions[cardId];
}

export function getSalesCardDefinition(cardId: SalesCardId) {
  return salesCardDefinitions[cardId];
}

export function listBudgetCardDefinitions() {
  return Object.values(budgetCardDefinitions);
}

export function listSalesCardDefinitions() {
  return Object.values(salesCardDefinitions);
}

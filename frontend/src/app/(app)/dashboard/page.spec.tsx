import { render, screen } from "@testing-library/react";

import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("renders the executive dashboard shell", () => {
    render(<DashboardPage />);

    expect(screen.getByText(/orcamentos/i)).toBeInTheDocument();
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });
});

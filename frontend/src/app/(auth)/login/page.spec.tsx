import { render, screen } from "@testing-library/react";

import LoginPage from "./page";

describe("LoginPage", () => {
  it("renders the branded split login shell", () => {
    render(<LoginPage />);

    expect(screen.getByText(/sinapse hub/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email ou usuario/i)).toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

import LoginPage from "./page";
import { mockRouter } from "@/test/setup";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the branded split login shell", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: /entrar no workspace sinapse hub/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email ou usuario/i)).toBeInTheDocument();
  });

  it("keeps the user on login when credentials are blank", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByText(/informe email ou usuario e senha/i)).toBeInTheDocument();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("navigates to the dashboard only after both fields are filled", async () => {
    vi.useFakeTimers();

    try {
      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/email ou usuario/i), {
        target: { value: "maria@sinapsehub.com" },
      });
      fireEvent.change(screen.getByLabelText(/senha/i), {
        target: { value: "123456" },
      });
      fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(450);
      });

      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    } finally {
      vi.useRealTimers();
    }
  });
});

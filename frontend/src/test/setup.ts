import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

export const mockRouter = {
  push: vi.fn(),
  prefetch: vi.fn(),
  replace: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

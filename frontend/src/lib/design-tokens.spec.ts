import { designTokens } from "@/lib/design-tokens";

describe("design tokens", () => {
  it("uses the approved Sinapse palette", () => {
    expect(designTokens.colors.ink).toBe("#16161E");
    expect(designTokens.colors.navy).toBe("#202048");
    expect(designTokens.colors.paper).toBe("#F1EFE8");
  });
});

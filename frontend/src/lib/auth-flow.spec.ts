import { getPostLoginDestination } from "@/lib/auth-flow";

describe("getPostLoginDestination", () => {
  it("defaults demo users to the dashboard route", () => {
    expect(getPostLoginDestination({ role: "demo-user" })).toBe("/dashboard");
  });
});

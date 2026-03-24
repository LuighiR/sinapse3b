import { existsSync } from "node:fs";

describe("mockup cleanup", () => {
  it("removes the temporary mockup launcher", () => {
    expect(existsSync("scripts/mockup-server.cjs")).toBe(false);
  });
});

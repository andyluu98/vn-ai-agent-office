import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("product branding", () => {
  it("package.json is renamed", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.name).toBe("vn-ai-agent-office");
  });
});

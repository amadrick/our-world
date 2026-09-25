import { describe, expect, it } from "vitest";

import { smartQuotes } from "./typography";

describe("smartQuotes", () => {
  it("curls apostrophes and quotes", () => {
    expect(smartQuotes("Smuggler's Cove")).toBe("Smuggler’s Cove");
    expect(smartQuotes(`Ask for it "dorado style"`)).toBe("Ask for it “dorado style”");
    expect(smartQuotes("the '90s")).toBe("the ‘90s");
    expect(smartQuotes("rock 'n' roll")).toBe("rock ‘n’ roll");
  });

  it("leaves text without quotes alone", () => {
    expect(smartQuotes("Tartine Bakery")).toBe("Tartine Bakery");
  });
});

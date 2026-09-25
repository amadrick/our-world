import { describe, expect, it } from "vitest";

import { signatureShort } from "./signature";

describe("signatureShort", () => {
  it("drops parentheticals", () => {
    expect(signatureShort("Morning bun (Mission production hall)")).toBe("Morning bun");
    expect(signatureShort("Tea leaf salad (laphet thoke), tableside")).toBe(
      "Tea leaf salad, tableside",
    );
  });

  it("keeps the first of several alternatives", () => {
    expect(signatureShort("Pollo a la brasa / Ceviche Limón")).toBe("Pollo a la brasa");
    expect(signatureShort("Curated wine list + live jazz nights")).toBe("Curated wine list");
    expect(
      signatureShort(
        "Short & Sweet (red bean–cherry espresso) / passion-fruit chocolate cappuccino",
      ),
    ).toBe("Short & Sweet");
  });

  it("leaves plain subjects alone", () => {
    expect(signatureShort("Salted caramel ice cream")).toBe("Salted caramel ice cream");
    expect(signatureShort("Italian combo on Dutch crunch")).toBe("Italian combo on Dutch crunch");
  });
});

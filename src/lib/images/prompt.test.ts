import { describe, expect, it } from "vitest";

import { assertArchitecture, buildPrompt, foodIn, placeVisual } from "./prompt.mjs";

describe("the food guard", () => {
  it("flags food and drink subjects", () => {
    expect(foodIn("a morning bun on a small plate")).toBe("bun");
    expect(foodIn("a Laurel martini in a Nick and Nora glass")).toBe("martini");
    expect(foodIn("a scoop of salted caramel ice cream")).toBe("scoop");
    expect(foodIn("a pint of pale lager on a picnic table")).toBe("pint");
    expect(() => buildPrompt({ subject: "a tray of tacos", scene: "facade" })).toThrow(/never food/);
  });

  it("allows buildings, rooms, and names on signs", () => {
    expect(foodIn('a narrow storefront, with a simple crisp sign that reads "GOLDEN BOY PIZZA"')).toBeUndefined();
    expect(foodIn("a Parisian-style wine bar in a brick building")).toBeUndefined();
    expect(foodIn("an old-school steakhouse in a Tudor-style building")).toBeUndefined();
    expect(() => assertArchitecture("a dive bar room with a wall of tap handles")).not.toThrow();
  });
});

describe("placeVisual", () => {
  it("uses the place's brief", () => {
    expect(
      placeVisual({ name: "Toronado", category: "bar", placeVisualSubject: "a dive bar room", placeVisualScene: "interior" }),
    ).toEqual({ subject: "a dive bar room", scene: "interior" });
  });

  it("falls back to a storefront with the name on the sign", () => {
    const visual = placeVisual({ name: "Bi-Rite Creamery", category: "dessert", neighborhood: "Mission" });
    expect(visual.scene).toBe("facade");
    expect(visual.subject).toContain('"BI-RITE CREAMERY"');
    expect(() => buildPrompt(visual)).not.toThrow();
  });
});

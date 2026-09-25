import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { assertNoFood, foodIn } from "./food-guard.mjs";
import { buildPrompt, readPromptTemplate, referenceNotes } from "./prompt.mjs";

const template = readPromptTemplate();

const place = {
  name: "Tartine Bakery",
  neighborhood: "Mission",
  address: "600 Guerrero St, San Francisco, CA 94110",
  placeResearch: {
    street: "Corner of Guerrero and 18th, a block from Dolores Park.",
    terrain: "Flat, sunny corner.",
    architecture: "A cream Edwardian corner building with dark green trim.",
    unique: "The line wraps around the corner.",
    iconic: ["dark green trim", "corner entrance"],
    view: "facade" as const,
    sources: ["https://tartinebakery.com/"],
  },
};

describe("buildPrompt", () => {
  it("uses Andy's prompt verbatim, filling in only the name and city", () => {
    const prompt = buildPrompt(place, { template });
    const expected = template
      .replace("[RESTAURANT NAME]", "Tartine Bakery")
      .replace("[CITY]", "San Francisco");
    expect(prompt.startsWith(expected)).toBe(true);
    expect(prompt).not.toContain("[RESTAURANT NAME]");
    expect(prompt).not.toContain("[CITY]");
  });

  it("reads the template file as committed", () => {
    const file = readFileSync(path.join(process.cwd(), "src/lib/images/kodak-place-prompt.md"), "utf8");
    expect(template).toBe(file);
    expect(template).toContain("Create **one square image** for **[RESTAURANT NAME] in [CITY]**.");
  });

  it("appends the research as a separate reference block", () => {
    const tail = buildPrompt(place, { template }).slice(template.length);
    expect(tail).toContain("\n---\n\nReference notes for this place:\n");
    expect(tail).toContain("- Neighborhood and street: Mission. Corner of Guerrero and 18th");
    expect(tail).toContain("- Most iconic physical characteristics: dark green trim; corner entrance");
    expect(tail).toContain("- Most recognizable view: the facade");
    expect(tail).not.toContain("tartinebakery.com");
  });

  it("uses a specific vantage in place of the plain view when one is set", () => {
    const framed = {
      ...place,
      placeResearch: { ...place.placeResearch, viewNote: "the corner doorway, seen close up from the sidewalk" },
    };
    const tail = buildPrompt(framed, { template }).slice(template.length);
    expect(tail).toContain("- Most recognizable view: the corner doorway, seen close up from the sidewalk\n");
    expect(tail).not.toContain("- Most recognizable view: the facade");
  });

  it("still gives the neighborhood, but never the street address, when there's no research yet", () => {
    const notes = referenceNotes({ name: "Zuni Café", neighborhood: "Hayes Valley", address: "1658 Market St" });
    expect(notes).toBe("Reference notes for this place:\n- Neighborhood and street: Hayes Valley");
  });

  it("refuses reference notes that describe food", () => {
    const hungry = { ...place, placeResearch: { ...place.placeResearch, iconic: ["a morning bun on a plate"] } };
    expect(() => buildPrompt(hungry, { template })).toThrow(/never food/);
  });
});

describe("the food guard", () => {
  it("flags food and drink", () => {
    expect(foodIn("a morning bun on a small plate")).toBe("bun");
    expect(foodIn("a Laurel martini in a Nick and Nora glass")).toBe("martini");
    expect(foodIn("a pint of pale lager on a picnic table")).toBe("pint");
  });

  it("allows buildings, rooms, and names on signs", () => {
    expect(foodIn('a narrow storefront under a sign that reads "GOLDEN BOY PIZZA"')).toBeUndefined();
    expect(foodIn("a Parisian-style wine bar in a brick building")).toBeUndefined();
    expect(foodIn("an old-school steakhouse in a Tudor-style building")).toBeUndefined();
    expect(() => assertNoFood("a dive bar room with a wall of tap handles")).not.toThrow();
  });
});

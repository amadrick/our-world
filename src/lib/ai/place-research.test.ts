import { afterEach, describe, expect, it, vi } from "vitest";

import { NEEDS_SIGNATURE, researchPlace, withoutFood } from "./place-research.mjs";

const place = { name: "Tartine Bakery", category: "bakery", neighborhood: "Mission", address: "" };

function reply(result: object, annotations: object[] = []) {
  return new Response(
    JSON.stringify({
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(result), annotations }],
        },
      ],
    }),
  );
}

const found = {
  signatureSubject: "Morning bun",
  signatureRationale: "The bakery's best-known pastry.",
  street: "Corner of Guerrero and 18th, a block from Dolores Park.",
  terrain: "Flat, sunny corner in the Mission's warm belt.",
  architecture: "A cream Edwardian corner building with dark green trim and tall windows.",
  unique: "The line wraps around the corner most mornings.",
  iconic: ["dark green trim", "corner entrance", "a morning bun in the window"],
  view: "facade",
  sources: ["https://tartinebakery.com/"],
  unverified: "",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("researchPlace", () => {
  it("asks for a signature by hand when there's no key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await researchPlace(place, { apiKey: "" })).toEqual({
      source: "none",
      notice: NEEDS_SIGNATURE,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses web search and keeps the cited sources", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply(found, [{ type: "url_citation", url: "https://sf.eater.com/tartine" }]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchPlace(place, { apiKey: "sk-test" });
    expect(result).toMatchObject({ signatureSubject: "Morning bun", source: "web" });
    expect(result.placeResearch).toMatchObject({
      view: "facade",
      sources: ["https://tartinebakery.com/", "https://sf.eater.com/tartine"],
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toEqual([{ type: "web_search" }]);
  });

  it("falls back to the model alone, flagged, when web search fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "no tools" } }), { status: 400 }))
      .mockResolvedValueOnce(reply(found));
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchPlace(place, { apiKey: "sk-test" });
    expect(result).toMatchObject({ signatureSubject: "Morning bun", source: "model" });
    expect(result.notice).toMatch(/double-check/i);
    expect(result.placeResearch?.unverified).toMatch(/memory/);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tools).toBeUndefined();
  });

  it("keeps food out of the physical notes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reply({ ...found, architecture: "A cream corner building. Croissants fill the window." }),
      ),
    );
    const { placeResearch } = await researchPlace(place, { apiKey: "sk-test" });
    expect(placeResearch?.architecture).toBe("A cream corner building.");
    expect(placeResearch?.iconic).toEqual(["dark green trim", "corner entrance"]);
  });

  it("says a signature is needed when nothing reliable turns up", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ ...found, signatureSubject: "" })));
    const result = await researchPlace(place, { apiKey: "sk-test" });
    expect(result.signatureSubject).toBeUndefined();
    expect(result.notice).toBe(NEEDS_SIGNATURE);
  });
});

describe("withoutFood", () => {
  it("drops only the sentences that mention food", () => {
    expect(withoutFood('Hand-painted "PIZZA" sign. A bowl of noodles; brick walls.')).toBe(
      'Hand-painted "PIZZA" sign. brick walls.',
    );
  });
});

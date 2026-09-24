import { afterEach, describe, expect, it, vi } from "vitest";

import { NEEDS_SIGNATURE, researchSignature } from "./signature-research.mjs";

const place = { name: "Tartine Bakery", category: "bakery", neighborhood: "Mission", address: "" };

function reply(result: object) {
  return new Response(
    JSON.stringify({
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }],
    }),
  );
}

const found = {
  signatureSubject: "Morning bun",
  signatureRationale: "The bakery's best-known pastry.",
  visual: "a morning bun on a plate",
  scene: "object",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("researchSignature", () => {
  it("asks for a signature by hand when there's no key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await researchSignature(place, { apiKey: "" })).toEqual({
      source: "none",
      notice: NEEDS_SIGNATURE,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses web search when it works", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(found));
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchSignature(place, { apiKey: "sk-test" });
    expect(result).toMatchObject({ signatureSubject: "Morning bun", source: "web", scene: "object" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools).toEqual([{ type: "web_search" }]);
  });

  it("falls back to the model alone, flagged, when web search fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "no tools" } }), { status: 400 }))
      .mockResolvedValueOnce(reply(found));
    vi.stubGlobal("fetch", fetchMock);
    const result = await researchSignature(place, { apiKey: "sk-test" });
    expect(result).toMatchObject({ signatureSubject: "Morning bun", source: "model" });
    expect(result.notice).toMatch(/double-check/i);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tools).toBeUndefined();
  });

  it("says a signature is needed when nothing reliable turns up", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ ...found, signatureSubject: "" })));
    const result = await researchSignature(place, { apiKey: "sk-test" });
    expect(result.signatureSubject).toBeUndefined();
    expect(result.notice).toBe(NEEDS_SIGNATURE);
  });
});

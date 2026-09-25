import { describe, expect, it } from "vitest";

import { blurLayers, dissolveGradient } from "./progressive-blur";

describe("blurLayers", () => {
  it("doubles the blur with each layer, up to the strongest at the bottom", () => {
    const layers = blurLayers(7, 48);
    expect(layers.map((l) => l.blur)).toEqual([0.75, 1.5, 3, 6, 12, 24, 48]);
  });

  it("masks each layer to a band that starts lower than the last", () => {
    const starts = blurLayers(7, 48).map((l) => parseFloat(l.mask.match(/transparent ([\d.]+)%/)![1]));
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(new Set(starts).size).toBe(starts.length);
  });

  it("holds the strongest layers to the bottom edge", () => {
    const layers = blurLayers(7, 48);
    expect(layers.at(-1)!.mask).toMatch(/black [\d.]+%\)$/);
    expect(layers[0].mask).toMatch(/transparent [\d.]+%\)$/);
  });
});

describe("dissolveGradient", () => {
  it("runs from clear to the solid page color", () => {
    const gradient = dissolveGradient("#23453b");
    expect(gradient).toMatch(/^linear-gradient\(to bottom, #23453b00 0%/);
    expect(gradient).toMatch(/#23453bff 100%\)$/);
  });
});

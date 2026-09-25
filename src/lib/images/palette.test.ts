import { describe, expect, it } from "vitest";

import {
  VIVIDNESS,
  contrastRatio,
  darkPinColor,
  pageColor,
  shade,
  tintToward,
  whiteTextReads,
} from "./palette.mjs";

/** A flat run of pixels, [r, g, b] repeated n times. */
const fill = (rgb: [number, number, number], n: number) => Array.from({ length: n }, () => rgb).flat();
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe("pageColor", () => {
  it("takes a red photo to a dark red that white text reads on", () => {
    const color = pageColor(fill([200, 40, 40], 400));
    const [r, g, b] = channels(color);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    expect(whiteTextReads(color)).toBe(true);
  });

  it("looks past the film's amber cast to the photo's own color", () => {
    const amberRoom = fill([190, 130, 60], 900);
    const greenAwning = fill([40, 120, 80], 100);
    const [r, g, b] = channels(pageColor([...amberRoom, ...greenAwning]));
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it("keeps the amber when nothing else covers enough of the picture", () => {
    const amberRoom = fill([190, 130, 60], 995);
    const speck = fill([40, 80, 200], 5);
    const [r, , b] = channels(pageColor([...amberRoom, ...speck]));
    expect(r).toBeGreaterThan(b);
  });

  it("gives a grey photo a near-neutral dark", () => {
    const [r, g, b] = channels(pageColor(fill([128, 128, 128], 400)));
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(12);
  });
});

/** OKLCH chroma of a "#rrggbb" color. */
function chromaOf(hex: string) {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = channels(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.hypot(A, B);
}

describe("pageColor vividness", () => {
  const dustyRed = fill([150, 78, 70], 400);

  it("raises chroma by the VIVIDNESS knob", () => {
    const flat = chromaOf(pageColor(dustyRed, { vividness: 0 }));
    const lively = chromaOf(pageColor(dustyRed));
    expect(VIVIDNESS).toBeGreaterThan(0);
    expect(lively / flat).toBeGreaterThan(1 + VIVIDNESS * 0.8);
  });

  it("gives a muddy photo a real color, not grey-brown", () => {
    const muddy = fill([122, 104, 82], 400);
    expect(chromaOf(pageColor(muddy))).toBeGreaterThan(0.055);
  });

  it("never goes neon", () => {
    for (const rgb of [[255, 0, 0], [0, 200, 0], [0, 60, 255], [255, 0, 200]] as [number, number, number][]) {
      expect(chromaOf(pageColor(fill(rgb, 400)))).toBeLessThanOrEqual(0.152);
    }
  });

  it("keeps white text and its 70% tint at AA on every hue", () => {
    for (let hue = 0; hue < 360; hue += 30) {
      const rad = (hue * Math.PI) / 180;
      const rgb = [128 + 90 * Math.cos(rad), 128 + 90 * Math.cos(rad - 2.1), 128 + 90 * Math.cos(rad + 2.1)].map(
        Math.round,
      ) as [number, number, number];
      expect(whiteTextReads(pageColor(fill(rgb, 400))), `hue ${hue}`).toBe(true);
    }
  });

  it("prefers the more vivid of two colors that cover the photo about equally", () => {
    const greyBlue = fill([92, 104, 124], 500);
    const brightRed = fill([190, 50, 45], 460);
    const [r, , b] = channels(pageColor([...greyBlue, ...brightRed]));
    expect(r).toBeGreaterThan(b);
  });

  it("keeps the most common color when it clearly dominates", () => {
    const greyBlue = fill([92, 104, 124], 800);
    const brightRed = fill([190, 50, 45], 200);
    const [r, , b] = channels(pageColor([...greyBlue, ...brightRed]));
    expect(b).toBeGreaterThan(r);
  });
});

describe("darkPinColor", () => {
  it("lifts a place color for the dark map while white text still reads", () => {
    for (const color of ["#23453b", "#6b2012", "#403e28", "#2a3f58"]) {
      const lifted = darkPinColor(color);
      expect(contrastRatio(lifted, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(lifted, "#000000")).toBeGreaterThan(contrastRatio(color, "#000000"));
    }
  });
});

describe("shade", () => {
  it("keeps the hue while moving the lightness", () => {
    const pale = shade("#23453b", 0.93, 0.6);
    const [r, g, b] = channels(pale);
    expect(Math.min(r, g, b)).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(r);
  });
});

describe("tintToward", () => {
  it("leans toward the tint's hue without changing how light the color is", () => {
    const cream = "#f2eee6";
    const green = tintToward(cream, "#23453b", 0.6, 0.03);
    const [r, g] = channels(green);
    expect(g).toBeGreaterThan(r);
    expect(Math.abs(contrastRatio(green, "#8e8679") - contrastRatio(cream, "#8e8679"))).toBeLessThan(0.15);
  });

  it("leaves the color alone at zero mix", () => {
    expect(tintToward("#f2eee6", "#23453b", 0, 0.03)).toBe("#f2eee6");
  });
});

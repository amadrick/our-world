import { describe, expect, it } from "vitest";

import { contrastRatio, pageColor, shade } from "./palette.mjs";

/** A flat run of pixels, [r, g, b] repeated n times. */
const fill = (rgb: [number, number, number], n: number) => Array.from({ length: n }, () => rgb).flat();
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe("pageColor", () => {
  it("takes a red photo to a dark red that white text reads on", () => {
    const color = pageColor(fill([200, 40, 40], 400));
    const [r, g, b] = channels(color);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    expect(contrastRatio(color, "#ffffff")).toBeGreaterThan(10);
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

describe("shade", () => {
  it("keeps the hue while moving the lightness", () => {
    const pale = shade("#23453b", 0.93, 0.6);
    const [r, g, b] = channels(pale);
    expect(Math.min(r, g, b)).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(r);
  });
});

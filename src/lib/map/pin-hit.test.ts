import { describe, expect, it } from "vitest";

import { MIN_TARGET, hitBoxes, resolveTap, type ShownPin } from "./pin-hit";

const pin = (id: string, x: number, y: number, extra: Partial<ShownPin> = {}): ShownPin => ({
  id,
  x,
  y,
  kind: "glyph",
  tier: 3,
  text: { width: 80, height: 14 },
  display: "icon",
  ...extra,
});

describe("pin taps", () => {
  it("gives every shown pin at least a 44 pt target", () => {
    const [head] = hitBoxes(pin("a", 100, 100));
    expect(head.right - head.left).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(head.bottom - head.top).toBeGreaterThanOrEqual(MIN_TARGET);
    // 20 px from a 22 px pin's center is still a hit; hidden pins never are.
    expect(resolveTap([pin("a", 100, 100)], { x: 100, y: 120 })).toEqual({ kind: "pin", id: "a" });
    expect(resolveTap([pin("a", 100, 100, { display: "hidden" })], { x: 100, y: 100 })).toEqual({ kind: "none" });
    expect(resolveTap([pin("a", 100, 100)], { x: 160, y: 100 })).toEqual({ kind: "none" });
  });

  it("counts a tap on the name label", () => {
    // A glyph's name sits to its right: 11 px radius + 5 px gap, 80 px wide.
    const named = pin("a", 100, 100, { display: "named" });
    expect(resolveTap([named], { x: 170, y: 102 })).toEqual({ kind: "pin", id: "a" });
    expect(resolveTap([pin("a", 100, 100)], { x: 170, y: 102 })).toEqual({ kind: "none" });
  });

  it("picks the pin nearest the finger, not the one drawn on top", () => {
    const pins = [pin("left", 100, 100), pin("right", 124, 100)];
    expect(resolveTap(pins, { x: 104, y: 100 })).toEqual({ kind: "pin", id: "left" });
    expect(resolveTap(pins, { x: 121, y: 100 })).toEqual({ kind: "pin", id: "right" });
  });

  it("prefers a pin under the finger over a neighbor's label", () => {
    const pins = [pin("labelled", 100, 100, { display: "named" }), pin("under", 150, 100)];
    expect(resolveTap(pins, { x: 150, y: 101 })).toEqual({ kind: "pin", id: "under" });
  });

  it("calls a tap equally between pins a cluster, to zoom in on", () => {
    const pins = [pin("a", 100, 100), pin("b", 108, 100), pin("far", 300, 300)];
    expect(resolveTap(pins, { x: 104, y: 100 })).toEqual({ kind: "cluster", ids: ["a", "b"] });
  });

  it("keeps the open place when the finger is on it", () => {
    // The balloon's head lifts above its spot; a neighbor sits right by the tip.
    const pins = [pin("open", 100, 100, { selected: true }), pin("b", 104, 100)];
    expect(resolveTap(pins, { x: 100, y: 80 })).toEqual({ kind: "pin", id: "open" });
  });
});

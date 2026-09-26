import { describe, expect, it } from "vitest";

import { FEW_PLACES, iconBox, layoutPins, nameBox, type PinCandidate } from "./pin-layout";
import { estimateText } from "./pin-style";

const view = { width: 1000, height: 800 };
const pin = (id: string, x: number, y: number, extra: Partial<PinCandidate> = {}): PinCandidate => ({
  id,
  x,
  y,
  kind: "glyph",
  text: { width: 80, height: 14 },
  tier: 3,
  ...extra,
});
/** Off-screen filler, so the set counts as the full guide rather than a narrow filter. */
const crowd = Array.from({ length: FEW_PLACES }, (_, i) => pin(`far-${i}`, 5000 + i * 100, 5000));

describe("layoutPins", () => {
  it("shows only the photo landmarks and the top places zoomed out", () => {
    const layout = layoutPins(
      [pin("sight", 200, 200, { kind: "photo", tier: 1 }), pin("pick", 500, 200, { tier: 2 }), pin("rest", 800, 200), ...crowd],
      view,
      12,
    );
    expect(layout.get("sight")).toBe("named");
    expect(layout.get("pick")).toBe("icon");
    expect(layout.get("rest")).toBe("hidden");
  });

  it("reveals the rest as you zoom in, then all their names", () => {
    const pins = [pin("pick", 300, 200, { tier: 2 }), pin("rest", 700, 200), ...crowd];
    expect(layoutPins(pins, view, 13.5).get("rest")).toBe("icon");
    expect(layoutPins(pins, view, 14.2).get("pick")).toBe("named");
    expect(layoutPins(pins, view, 14.2).get("rest")).toBe("icon");
    expect(layoutPins(pins, view, 15).get("rest")).toBe("named");
  });

  it("shows every result of a narrow filter right away", () => {
    const layout = layoutPins([pin("a", 200, 200), pin("b", 600, 200)], view, 12);
    expect(layout.get("a")).toBe("icon");
    expect(layout.get("b")).toBe("icon");
  });

  it("shows every icon of a wide filter, including overlaps below the tier zoom", () => {
    const pins = Array.from({ length: 40 }, (_, i) =>
      pin(`p${i}`, 220 + (i % 5) * 6, 220 + Math.floor(i / 5) * 6, { tier: 2 }),
    );
    const hidden = layoutPins(pins, view, 10.5);
    expect([...hidden.values()].every((display) => display === "hidden")).toBe(true);
    const shown = layoutPins(pins, view, 10.5, { everyIcon: true });
    expect([...shown.values()].filter((display) => display !== "hidden")).toHaveLength(40);
  });

  it("gives the icon to the higher tier when two collide", () => {
    const layout = layoutPins([pin("rest", 300, 300), pin("pick", 305, 300, { tier: 2 }), pin("sight", 900, 700, { kind: "photo", tier: 1 })], view, 15);
    expect(layout.get("pick")).toBe("named");
    expect(layout.get("rest")).toBe("hidden");
  });

  it("drops a name, never the icon, when the name would cover a neighbor", () => {
    // b's icon sits where a's name would go.
    const layout = layoutPins([pin("a", 300, 300, { tier: 2 }), pin("b", 360, 300)], view, 16);
    expect(layout.get("a")).toBe("icon");
    expect(layout.get("b")).toBe("named");
  });

  it("keeps a name from running into another name", () => {
    const layout = layoutPins([pin("a", 300, 300, { tier: 2 }), pin("b", 250, 318, { tier: 2 })], view, 16);
    expect([layout.get("a"), layout.get("b")].sort()).toEqual(["icon", "named"]);
  });

  it("places the selected pin first with its name, whatever it covers", () => {
    const layout = layoutPins([pin("a", 300, 300, { tier: 1, kind: "photo" }), pin("sel", 300, 300, { forced: true, selected: true })], view, 12);
    expect(layout.get("sel")).toBe("named");
    expect(layout.get("a")).toBe("hidden");
  });

  it("hides off-screen pins, so their photos aren't fetched", () => {
    const layout = layoutPins([pin("far", 2000, 300, { kind: "photo", tier: 1 })], view, 15);
    expect(layout.get("far")).toBe("hidden");
  });

  it("lifts the selected balloon's head above the spot, with its caption under the tip", () => {
    const sel = pin("sel", 300, 300, { kind: "photo", selected: true });
    const icon = iconBox(sel, 0);
    expect(icon.bottom).toBe(300);
    expect(icon.top).toBeLessThan(300 - 56);
    expect(nameBox(sel, 0).top).toBeGreaterThanOrEqual(300);
  });
});

describe("estimateText", () => {
  it("wraps long names onto balanced lines like Apple's, and short ones stay on one", () => {
    expect(estimateText("Zuni", "glyph").height).toBe(14);
    expect(estimateText("Golden Gate Fortune Cookie Factory", "glyph").height).toBeGreaterThan(14);
    expect(estimateText("Lands End & Sutro Baths", "photo").height).toBe(24);
  });
});

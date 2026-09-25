import { describe, expect, it } from "vitest";

import { densityForZoom, layoutPins, type PinCandidate } from "./pin-layout";

const view = { width: 1000, height: 800 };
const pin = (id: string, x: number, y: number, extra: Partial<PinCandidate> = {}): PinCandidate => ({
  id,
  x,
  y,
  labelWidth: 100,
  ...extra,
});

describe("densityForZoom", () => {
  it("shows dots across the city, photos by neighborhood, names by the block", () => {
    expect(densityForZoom(12)).toBe("dot");
    expect(densityForZoom(14)).toBe("photo");
    expect(densityForZoom(16)).toBe("label");
  });
});

describe("layoutPins", () => {
  it("keeps every pin a dot when zoomed out, except the selected one", () => {
    const layout = layoutPins([pin("a", 100, 100), pin("b", 400, 400, { forced: true })], view, "dot");
    expect(layout.get("a")).toBe("dot");
    expect(layout.get("b")).toBe("label");
  });

  it("steps a pin down to a dot where photos would pile up", () => {
    const layout = layoutPins([pin("a", 300, 300), pin("b", 310, 305), pin("c", 600, 300)], view, "photo");
    expect(layout.get("a")).toBe("photo");
    expect(layout.get("b")).toBe("dot");
    expect(layout.get("c")).toBe("photo");
  });

  it("gives Andy's picks the photo when two collide", () => {
    const layout = layoutPins([pin("a", 300, 300), pin("pick", 305, 300, { preferred: true })], view, "photo");
    expect(layout.get("pick")).toBe("photo");
    expect(layout.get("a")).toBe("dot");
  });

  it("drops the name before the photo when a label would run into a neighbor", () => {
    const layout = layoutPins([pin("a", 300, 300), pin("b", 400, 300)], view, "label");
    expect(layout.get("a")).toBe("photo");
    expect(layout.get("b")).toBe("label");
  });

  it("places the selected pin first, whatever it covers", () => {
    const layout = layoutPins([pin("a", 300, 300), pin("sel", 300, 300, { forced: true })], view, "label");
    expect(layout.get("sel")).toBe("label");
    expect(layout.get("a")).toBe("dot");
  });

  it("keeps off-screen pins as dots, so their photos aren't fetched", () => {
    const layout = layoutPins([pin("far", 2000, 300)], view, "photo");
    expect(layout.get("far")).toBe("dot");
  });
});

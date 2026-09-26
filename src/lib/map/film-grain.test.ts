import { describe, expect, it } from "vitest";

import { FILM_GRAIN_SIZE, filmGrainPixels } from "./film-grain";

describe("filmGrainPixels", () => {
  it("is a seamless mid-grey field, not a flat or blown-out tile", () => {
    const data = filmGrainPixels();
    expect(data.length).toBe(FILM_GRAIN_SIZE * FILM_GRAIN_SIZE);
    let sum = 0;
    let min = 255;
    let max = 0;
    for (const value of data) {
      sum += value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const mean = sum / data.length;
    expect(mean).toBeGreaterThan(90);
    expect(mean).toBeLessThan(165);
    expect(max - min).toBeGreaterThan(40);
  });
});

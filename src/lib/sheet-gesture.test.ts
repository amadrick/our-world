import { describe, expect, it } from "vitest";

import { GESTURE_SLOP, endGesture, gestureAxis } from "./gesture-axis";
import { FLICK_MIN_DISTANCE, dragOffset, settleSheet, velocityOf, type Sample } from "./sheet-gesture";

// A 852px phone: full at 0, the fixed 474px half sheet at 296, the peek at 594.
const offsets = { full: 0, mid: 296, peek: 594 };
const fromMid = (dy: number, velocity: number) =>
  settleSheet({ from: "mid", startOffset: offsets.mid, offset: offsets.mid + dy, velocity, offsets });

describe("sheet drag", () => {
  it("follows the finger 1:1 and resists past the ends", () => {
    expect(dragOffset(296, -20, 594)).toBe(276);
    expect(dragOffset(296, 8, 594)).toBe(304);
    expect(dragOffset(0, -40, 594)).toBe(-10);
    expect(dragOffset(594, 40, 594)).toBe(604);
  });

  it("reads velocity over the last stretch, not the whole drag", () => {
    const samples: Sample[] = [
      [0, 500],
      [300, 498],
      [320, 490],
      [340, 480],
      [360, 470],
    ];
    // From 300 ms (the earliest sample within 80 ms of the last) to 360 ms: 28 px up in 60 ms.
    expect(velocityOf(samples)).toBeCloseTo(-28 / 60, 5);
    expect(velocityOf([[0, 500]])).toBe(0);
  });

  it("settles small, slow drags back where they started", () => {
    for (const dy of [-8, -20, -40, 8, 20, 40]) expect(fromMid(dy, dy > 0 ? 0.1 : -0.1)).toBe("mid");
  });

  it("lets a quick flick up of a short distance open it, and one too short or too slow not", () => {
    expect(fromMid(-FLICK_MIN_DISTANCE, -0.8)).toBe("full");
    expect(fromMid(-40, -0.6)).toBe("full");
    expect(fromMid(-8, -1.2)).toBe("mid");
    expect(fromMid(-40, -0.3)).toBe("mid");
  });

  it("never dismisses the half sheet on a tiny flick down, only on a real one", () => {
    expect(fromMid(8, 1.2)).toBe("mid");
    expect(fromMid(20, 1.2)).toBe("mid");
    expect(fromMid(40, 0.9)).toBe("dismiss");
    expect(fromMid(180, 0.1)).toBe("dismiss");
  });

  it("settles to the nearest height by position plus a projection of velocity", () => {
    expect(fromMid(-200, 0)).toBe("full");
    expect(fromMid(-120, -0.3)).toBe("full");
    expect(settleSheet({ from: "full", startOffset: 0, offset: 120, velocity: 0.1, offsets })).toBe("full");
    expect(settleSheet({ from: "full", startOffset: 0, offset: 200, velocity: 0.1, offsets })).toBe("mid");
    expect(settleSheet({ from: "full", startOffset: 0, offset: 560, velocity: 0.2, offsets })).toBe("mid");
    expect(settleSheet({ from: "full", startOffset: 0, offset: 640, velocity: 0.2, offsets })).toBe("dismiss");
  });
});

describe("gesture axis", () => {
  it("decides once per touch after the slop, and every listener gets the same answer", () => {
    expect(gestureAxis(1, 2, -5)).toBeNull();
    expect(gestureAxis(1, 3, -GESTURE_SLOP - 1)).toBe("y");
    // A later sideways move doesn't flip it: the place swipe can't take a touch the sheet has.
    expect(gestureAxis(1, 60, -12)).toBe("y");
    endGesture(1);
    expect(gestureAxis(1, 60, -12)).toBe("x");
    endGesture(1);
  });
});

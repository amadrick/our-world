/**
 * What each pin shows: a dot in the place's color, its photo, or its photo
 * with the name beside it. Zoom sets how much pins may say; where pins would
 * pile up (a dense block like Valencia Street), the ones placed first keep
 * their photo and the rest step down to dots.
 */
export type PinDisplay = "dot" | "photo" | "label";

/** Photos from this zoom in, names beside them from LABEL_FROM_ZOOM. */
export const PHOTO_FROM_ZOOM = 13;
export const LABEL_FROM_ZOOM = 15.5;

/** Diameter of a photo pin, px. */
export const PHOTO_SIZE = 40;
/** Breathing room kept around each photo and label, px. */
const GAP = 4;
/** Pins this far off screen still count, so photos don't pop in right at the edge. */
const OFFSCREEN = 48;

export function densityForZoom(zoom: number): PinDisplay {
  if (zoom >= LABEL_FROM_ZOOM) return "label";
  return zoom >= PHOTO_FROM_ZOOM ? "photo" : "dot";
}

/** How far a name label reaches past the photo's right edge: its text (14px semibold) and padding. */
export function estimateLabelWidth(name: string): number {
  return 18 + Math.min(176, Math.round(name.length * 7.4));
}

export interface PinCandidate {
  id: string;
  /** Screen position, px from the map's top left. */
  x: number;
  y: number;
  labelWidth: number;
  /** Selected or hovered: always shown in full, and placed first. */
  forced?: boolean;
  /** Andy's picks: placed before the rest. */
  preferred?: boolean;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const R = PHOTO_SIZE / 2;

function box(pin: PinCandidate, display: "photo" | "label"): Box {
  return {
    left: pin.x - R - GAP,
    top: pin.y - R - GAP,
    right: pin.x + R + GAP + (display === "label" ? pin.labelWidth : 0),
    bottom: pin.y + R + GAP,
  };
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Photos are placed first, then names wherever they fit, so a name never
 * pushes a neighbor's photo down to a dot.
 */
export function layoutPins(
  pins: PinCandidate[],
  viewport: { width: number; height: number },
  density: PinDisplay,
): Map<string, PinDisplay> {
  const result = new Map<string, PinDisplay>();
  const rank = (p: PinCandidate) => (p.forced ? 0 : p.preferred ? 1 : 2);
  const ordered = [...pins].sort((a, b) => rank(a) - rank(b));
  const placed: Box[] = [];
  const fits = (b: Box) => !placed.some((p) => overlaps(p, b));

  const photos: PinCandidate[] = [];
  for (const pin of ordered) {
    if (pin.forced) {
      result.set(pin.id, "label");
      placed.push(box(pin, "label"));
      continue;
    }
    const offscreen =
      pin.x < -OFFSCREEN ||
      pin.y < -OFFSCREEN ||
      pin.x > viewport.width + OFFSCREEN ||
      pin.y > viewport.height + OFFSCREEN;
    const photo = box(pin, "photo");
    if (density !== "dot" && !offscreen && fits(photo)) {
      result.set(pin.id, "photo");
      placed.push(photo);
      photos.push(pin);
    } else {
      result.set(pin.id, "dot");
    }
  }

  if (density === "label") {
    for (const pin of photos) {
      const name = { ...box(pin, "label"), left: pin.x + R + GAP };
      if (fits(name)) {
        result.set(pin.id, "label");
        placed.push(name);
      }
    }
  }
  return result;
}

import { PIN, balloonLift, type PinKind } from "./pin-style";

/**
 * Which pins show, and which show their names, the way Apple Maps decides:
 * zoomed out only the photo landmarks and the top places appear; zooming in
 * reveals the rest, then their names. Every icon is placed before any name, in
 * priority order, so a name drops out before it covers another pin or name,
 * and an icon stays when its name can't fit.
 */
export type PinDisplay = "hidden" | "icon" | "named";

export interface PinCandidate {
  id: string;
  /** Screen position, px from the map's top left. */
  x: number;
  y: number;
  kind: PinKind;
  /** The name (or caption) as it would be drawn. */
  text: { width: number; height: number };
  /** 1 sights, parks, museums; 2 Andy's picks; 3 the rest. */
  tier: 1 | 2 | 3;
  /** Selected or hovered: always shown with its name, and placed first. */
  forced?: boolean;
  /** The selected pin, drawn as the bigger balloon. */
  selected?: boolean;
}

/** Zoom at which each tier's icons appear, and then their names. */
export const ICON_FROM_ZOOM = { 1: 0, 2: 11, 3: 12.8 } as const;
export const NAME_FROM_ZOOM = { 1: 11.8, 2: 14, 3: 14.8 } as const;
/** A filter this narrow shows every result right away, a little earlier with names, like a search. */
export const FEW_PLACES = 30;
const FEW_NAME_HEADSTART = 0.6;
/** Pins this far off screen still count, so they don't pop in right at the edge. */
const OFFSCREEN = 48;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Room kept around each icon and name: generous zoomed out, so the city view stays sparse. */
export function gapForZoom(zoom: number): number {
  if (zoom < 12.5) return 8;
  return zoom < 14 ? 5 : 3;
}

/** Where the pin's head is drawn: the selected balloon lifts its head above the spot. */
function head(pin: PinCandidate): { cx: number; cy: number; r: number; tip: number } {
  if (pin.selected) {
    const size = pin.kind === "photo" ? PIN.photoSelected : PIN.glyphSelected;
    const lift = balloonLift(size);
    return { cx: pin.x, cy: pin.y - lift, r: size / 2, tip: pin.y };
  }
  const r = (pin.kind === "photo" ? PIN.photo : PIN.glyph) / 2;
  return { cx: pin.x, cy: pin.y, r, tip: pin.y + r };
}

export function iconBox(pin: PinCandidate, gap: number): Box {
  const { cx, cy, r, tip } = head(pin);
  return { left: cx - r - gap, top: cy - r - gap, right: cx + r + gap, bottom: Math.max(cy + r, tip) + gap };
}

/** Glyph names sit to the right of the head; photo captions sit centered below it. */
export function nameBox(pin: PinCandidate, gap: number): Box {
  const { cx, cy, r, tip } = head(pin);
  const { width, height } = pin.text;
  if (pin.kind === "glyph") {
    const left = cx + r + PIN.nameGap;
    return { left: left - gap, top: cy - height / 2 - gap, right: left + width + gap, bottom: cy + height / 2 + gap };
  }
  const top = (pin.selected ? tip : cy + r) + PIN.captionGap;
  return { left: cx - width / 2 - gap, top: top - gap, right: cx + width / 2 + gap, bottom: top + height + gap };
}

export function layoutPins(
  pins: PinCandidate[],
  viewport: { width: number; height: number },
  zoom: number,
  options?: { everyIcon?: boolean },
): Map<string, PinDisplay> {
  const result = new Map<string, PinDisplay>();
  // A filter asks for every match, even when the city is too wide for the usual
  // zoom tiers and the pins sit on top of each other. Names still take turns.
  const everyIcon = options?.everyIcon ?? false;
  const few = everyIcon || pins.length <= FEW_PLACES;
  const gap = gapForZoom(zoom);
  const ordered = [...pins].sort((a, b) => Number(b.forced ?? false) - Number(a.forced ?? false) || a.tier - b.tier);
  const placed: (Box & { owner: string })[] = [];
  // A name hugs its own icon, so only other pins' boxes count against it.
  const fits = (b: Box, owner: string) => !placed.some((p) => p.owner !== owner && overlaps(p, b));
  const place = (b: Box, owner: string) => placed.push({ ...b, owner });

  const shown: PinCandidate[] = [];
  for (const pin of ordered) {
    if (pin.forced) {
      result.set(pin.id, "named");
      place(iconBox(pin, gap), pin.id);
      place(nameBox(pin, gap), pin.id);
      continue;
    }
    result.set(pin.id, "hidden");
    const offscreen =
      pin.x < -OFFSCREEN ||
      pin.y < -OFFSCREEN ||
      pin.x > viewport.width + OFFSCREEN ||
      pin.y > viewport.height + OFFSCREEN;
    if (offscreen || (!few && zoom < ICON_FROM_ZOOM[pin.tier])) continue;
    const icon = iconBox(pin, gap);
    if (!everyIcon && !fits(icon, pin.id)) continue;
    result.set(pin.id, "icon");
    place(icon, pin.id);
    shown.push(pin);
  }

  for (const pin of shown) {
    if (zoom < NAME_FROM_ZOOM[pin.tier] - (few ? FEW_NAME_HEADSTART : 0)) continue;
    const name = nameBox(pin, gap);
    if (fits(name, pin.id)) {
      result.set(pin.id, "named");
      place(name, pin.id);
    }
  }
  return result;
}

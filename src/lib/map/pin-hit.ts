/**
 * Which pin a tap on the map means. Pins don't catch the touch themselves: the
 * map asks here, so a tap lands on the pin nearest the finger rather than on
 * whichever one happens to be drawn on top. Each pin answers for its drawn
 * head, grown to at least Apple's 44 pt target, and for its name label when the
 * name is showing. Two pins equally under the finger are a cluster, and the
 * map zooms in to separate them, the way Apple Maps treats a tap on a cluster.
 */
import { iconBox, nameBox, type PinCandidate, type PinDisplay } from "./pin-layout";

/** Apple HIG's minimum tap target, pt. */
export const MIN_TARGET = 44;
/** Room around a name label that still counts as a tap on it. */
export const TARGET_PAD = 6;
/** Two pins whose distances from the tap differ by less than this are a tie. */
export const TIE_PX = 6;
/** A tap on a name counts a little farther away than a tap on a head, so a pin under the finger wins over a neighbor's label. */
const NAME_PENALTY = 8;

export interface ShownPin extends PinCandidate {
  display: PinDisplay;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const inside = (b: Box, p: { x: number; y: number }) => p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
const distanceTo = (b: Box, p: { x: number; y: number }) =>
  Math.hypot(Math.max(b.left - p.x, 0, p.x - b.right), Math.max(b.top - p.y, 0, p.y - b.bottom));

function grow(box: Box, min: number, pad: number): Box {
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const w = Math.max(box.right - box.left + pad * 2, min);
  const h = Math.max(box.bottom - box.top + pad * 2, min);
  return { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2 };
}

/** The areas a pin answers for: its head (at least 44 × 44) and, when shown, its name. */
export function hitBoxes(pin: ShownPin): Box[] {
  const boxes = [grow(iconBox(pin, 0), MIN_TARGET, TARGET_PAD)];
  if (pin.display === "named") boxes.push(grow(nameBox(pin, 0), 0, TARGET_PAD));
  return boxes;
}

/** How far the tap is from the pin: from its head's center, or from its name (with a small penalty). */
function score(pin: ShownPin, p: { x: number; y: number }): number {
  const head = iconBox(pin, 0);
  const center = { x: (head.left + head.right) / 2, y: (head.top + head.bottom) / 2 };
  const toHead = Math.hypot(p.x - center.x, p.y - center.y);
  if (pin.display !== "named") return toHead;
  return Math.min(toHead, distanceTo(nameBox(pin, 0), p) + NAME_PENALTY);
}

export type TapResult = { kind: "pin"; id: string } | { kind: "cluster"; ids: string[] } | { kind: "none" };

export function resolveTap(pins: readonly ShownPin[], point: { x: number; y: number }): TapResult {
  const hits = pins
    .filter((pin) => pin.display !== "hidden" && hitBoxes(pin).some((b) => inside(b, point)))
    .map((pin) => ({ pin, score: score(pin, point) }))
    .sort((a, b) => a.score - b.score);
  if (hits.length === 0) return { kind: "none" };
  // The open place stays the answer when the finger is on its balloon.
  const open = hits.find((h) => h.pin.selected && inside(iconBox(h.pin, 0), point));
  if (open) return { kind: "pin", id: open.pin.id };
  const [best] = hits;
  const tied = hits.filter((h) => h.score - best.score < TIE_PX);
  return tied.length > 1 ? { kind: "cluster", ids: tied.map((h) => h.pin.id) } : { kind: "pin", id: best.pin.id };
}

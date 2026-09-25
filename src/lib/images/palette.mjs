// The background color a place's detail page sits on: the photo's main color,
// normalized to a dark shade so white text reads on it. Pure, so it runs
// anywhere; `sampleImageColor` in render.mjs feeds it pixels.
//
// Every picture is a warm film photo, so amber light tints nearly all of them.
// Taking the most common hue would give almost every place the same brown, so
// the amber band is set aside: the page takes the photo's biggest other color
// (a green awning, a pink facade, blue tile) and falls back to its amber only
// when nothing else covers enough of the picture.

/** Lightness of every page color (OKLCH), dark enough for white text at ~10:1 and its 70% tint above 5:1. */
const PAGE_LIGHTNESS = 0.36;
const MIN_CHROMA = 0.035;
const MAX_CHROMA = 0.11;
const HUE_BINS = 36;
/** Pixels below this chroma count as grey and don't vote. */
const COLORFUL = 0.03;
/** A non-amber hue must cover this share of the picture to win. */
const MIN_SHARE = 0.015;
/** OKLCH hues of the film's amber cast. */
const AMBER = [45, 95];
const NEUTRAL = { h: 60, c: 0.012 };

const toLinear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function rgbToOklab(r, g, b) {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinearRgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const hex = (rgb) =>
  `#${rgb
    .map((v) => Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255).toString(16).padStart(2, "0"))
    .join("")}`;

function oklchToHex(L, c, h) {
  const rad = (h * Math.PI) / 180;
  // Pull chroma in until the color fits in sRGB.
  for (let chroma = c; chroma > 0; chroma -= 0.002) {
    const rgb = oklabToLinearRgb(L, chroma * Math.cos(rad), chroma * Math.sin(rad));
    if (rgb.every((v) => v >= 0 && v <= 1)) return hex(rgb);
  }
  return hex(oklabToLinearRgb(L, 0, 0));
}

const hueOf = (a, b) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;

/**
 * Picks the page color from raw RGB pixels (3 bytes each).
 * @param {Uint8Array | number[]} pixels
 * @returns {string} "#rrggbb"
 */
export function pageColor(pixels) {
  const bins = Array.from({ length: HUE_BINS }, () => ({ n: 0, a: 0, b: 0 }));
  let counted = 0;
  for (let i = 0; i + 2 < pixels.length; i += 3) {
    const { L, a, b } = rgbToOklab(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (L < 0.12 || L > 0.97) continue;
    counted++;
    if (Math.hypot(a, b) < COLORFUL) continue;
    const bin = bins[Math.floor((hueOf(a, b) / 360) * HUE_BINS) % HUE_BINS];
    bin.n++;
    bin.a += a;
    bin.b += b;
  }
  // Neighbors share half their votes, so a hue split across two bins still counts as one.
  const scored = bins
    .map((bin, i) => ({
      ...bin,
      score: bin.n + 0.5 * (bins[(i + HUE_BINS - 1) % HUE_BINS].n + bins[(i + 1) % HUE_BINS].n),
    }))
    .filter((bin) => bin.n > 0);
  if (!scored.length) return oklchToHex(PAGE_LIGHTNESS, NEUTRAL.c, NEUTRAL.h);

  const amber = (bin) => {
    const h = hueOf(bin.a, bin.b);
    return h >= AMBER[0] && h <= AMBER[1];
  };
  const others = scored.filter((bin) => !amber(bin) && bin.score / counted >= MIN_SHARE);
  const pool = others.length ? others : scored;
  const top = pool.reduce((best, bin) => (bin.score > best.score ? bin : best));
  const a = top.a / top.n;
  const b = top.b / top.n;
  const chroma = Math.min(MAX_CHROMA, Math.max(MIN_CHROMA, Math.hypot(a, b) * 1.1));
  return oklchToHex(PAGE_LIGHTNESS, chroma, hueOf(a, b));
}

/** WCAG contrast ratio between two "#rrggbb" colors. */
export function contrastRatio(hexA, hexB) {
  const luminance = (value) => {
    const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(value.slice(i, i + 2), 16)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

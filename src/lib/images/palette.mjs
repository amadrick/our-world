// The background color a place's detail page sits on: the photo's main color,
// made livelier and normalized to a deep shade so white text reads on it.
// Pure, so it runs anywhere; `sampleImageColor` in render.mjs feeds it pixels.
//
// Every picture is a warm film photo, so amber light tints nearly all of them.
// Taking the most common hue would give almost every place the same brown, so
// the amber band is set aside: the page takes the photo's biggest other color
// (a green awning, a pink facade, blue tile) and falls back to its amber only
// when nothing else covers enough of the picture.
//
// The film also mutes every color, so the pick is then made livelier in
// OKLCH: same hue, chroma raised by VIVIDNESS (from the most vivid pixels of
// that color, not a greyed average), never below a floor so a muddy photo
// still gets a real color, never past a cap so nothing goes neon, and as
// light as it can be while white text, and its 70% tint, keep AA contrast.

/** How much livelier a page color is than the photo's own: chroma x (1 + VIVIDNESS). The one knob. */
export const VIVIDNESS = 0.2;
/** Every picked color gets at least this chroma, and at most the cap. */
const CHROMA_FLOOR = 0.065;
const CHROMA_CAP = 0.15;
/** The lightest a page color starts from; it steps darker until the text contrast holds. */
const PAGE_LIGHTNESS = 0.42;
const DARKEST = 0.3;
/** WCAG AA for body text: white on the color, and white at 70% (secondary text) on it. */
const AA = 4.5;
const HUE_BINS = 36;
/** A color within this share of the most common one counts as dominant too; the most vivid of them wins. */
const NEAR_TIE = 0.8;
/** The top share of a color's pixels by chroma: its vivid core, which the film hasn't greyed. */
const VIVID_SHARE = 0.5;
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

const channels = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));

/** `top` laid over `base` at `alpha`, as the browser blends it (in sRGB). */
function over(base, top, alpha) {
  const b = channels(base);
  const t = channels(top);
  return `#${b.map((v, i) => Math.round(t[i] * alpha + v * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}

/** White text and its 70% tint both read at AA on this color. */
export function whiteTextReads(color) {
  return contrastRatio(color, "#ffffff") >= AA && contrastRatio(color, over(color, "#ffffff", 0.7)) >= AA;
}

/** The lightest shade of this hue and chroma, from `from` down, that white text reads on. */
function readableShade(chroma, hue, from = PAGE_LIGHTNESS) {
  for (let L = from; L > DARKEST; L -= 0.005) {
    const color = oklchToHex(L, chroma, hue);
    if (whiteTextReads(color)) return color;
  }
  return oklchToHex(DARKEST, chroma, hue);
}

/**
 * Picks the page color from raw RGB pixels (3 bytes each).
 * @param {Uint8Array | number[]} pixels
 * @returns {string} "#rrggbb"
 */
export function pageColor(pixels, { vividness = VIVIDNESS } = {}) {
  const bins = Array.from({ length: HUE_BINS }, () => ({ n: 0, a: 0, b: 0, samples: [] }));
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
    bin.samples.push([a, b]);
  }
  // Neighbors share half their votes, so a hue split across two bins still counts as one.
  const scored = bins
    .map((bin, i) => ({
      ...bin,
      score: bin.n + 0.5 * (bins[(i + HUE_BINS - 1) % HUE_BINS].n + bins[(i + 1) % HUE_BINS].n),
    }))
    .filter((bin) => bin.n > 0);
  if (!scored.length) return readableShade(NEUTRAL.c, NEUTRAL.h);

  const amber = (bin) => {
    const h = hueOf(bin.a, bin.b);
    return h >= AMBER[0] && h <= AMBER[1];
  };
  const others = scored.filter((bin) => !amber(bin) && bin.score / counted >= MIN_SHARE);
  const pool = others.length ? others : scored;
  const topScore = Math.max(...pool.map((bin) => bin.score));

  // Each dominant color's vivid core: the mean of its most chromatic pixels.
  const vivid = (bin) => {
    const sorted = [...bin.samples].sort((p, q) => Math.hypot(q[0], q[1]) - Math.hypot(p[0], p[1]));
    const core = sorted.slice(0, Math.max(1, Math.round(sorted.length * VIVID_SHARE)));
    const a = core.reduce((sum, p) => sum + p[0], 0) / core.length;
    const b = core.reduce((sum, p) => sum + p[1], 0) / core.length;
    return { a, b, chroma: Math.hypot(a, b) };
  };
  const pick = pool
    .filter((bin) => bin.score >= topScore * NEAR_TIE)
    .map((bin) => ({ bin, core: vivid(bin) }))
    .reduce((best, next) => (next.core.chroma > best.core.chroma ? next : best));

  // The hue is the color's own average; the chroma comes from its vivid core.
  const hue = hueOf(pick.bin.a / pick.bin.n, pick.bin.b / pick.bin.n);
  const chroma = Math.min(CHROMA_CAP, Math.max(CHROMA_FLOOR, pick.core.chroma * (1 + vividness)));
  return readableShade(chroma, hue);
}

/**
 * A place color lifted for the dark map (pins and their name pills), as light
 * as it can be while white text on it keeps AA.
 * @param {string} hex "#rrggbb"
 */
export function darkPinColor(hex) {
  const [r, g, b] = channels(hex);
  const { a, b: bb } = rgbToOklab(r, g, b);
  const chroma = Math.hypot(a, bb) * 1.1;
  const hue = hueOf(a, bb);
  for (let L = 0.56; L > 0.4; L -= 0.005) {
    const color = oklchToHex(L, chroma, hue);
    if (contrastRatio(color, "#ffffff") >= AA) return color;
  }
  return oklchToHex(0.4, chroma, hue);
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

/**
 * The same hue at another lightness, with its chroma scaled, e.g. a pale
 * tint of a page color for a light background.
 * @param {string} hex "#rrggbb"
 */
export function shade(hex, lightness, chromaScale = 1) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const { a, b: bb } = rgbToOklab(r, g, b);
  return oklchToHex(lightness, Math.hypot(a, bb) * chromaScale, hueOf(a, bb));
}

/**
 * Leans a color toward another's hue at its own lightness, so what's drawn on
 * it keeps its contrast: `mix` of the way toward `tint`'s hue at `chroma`.
 * @param {string} hex "#rrggbb"
 * @param {string} tint "#rrggbb"
 */
export function tintToward(hex, tint, mix, chroma) {
  const channels = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const base = rgbToOklab(...channels(hex));
  const target = rgbToOklab(...channels(tint));
  const len = Math.hypot(target.a, target.b) || 1;
  const a = base.a + ((target.a / len) * chroma - base.a) * mix;
  const b = base.b + ((target.b / len) * chroma - base.b) * mix;
  return oklchToHex(base.L, Math.hypot(a, b), hueOf(a, b));
}

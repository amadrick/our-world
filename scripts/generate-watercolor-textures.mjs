/**
 * Draws the watercolor basemap's (?map=h) textures into public/textures/watercolor:
 * tileable procedural noise only, no source images. Each pigment texture is a
 * see-through overlay for one wash (water, brick, park): darker pigment where
 * it pools and pale blooms where it dried back, over the layer's flat color.
 * `paper` is the sheet's faint tone and `grain` its tooth, laid over everything.
 *
 *   npm run textures:watercolor
 *
 * Uses sharp (installed with Next) to write small WebP files.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const OUT = path.join(process.cwd(), "public/textures/watercolor");

/** A seeded hash for lattice points, wrapped to `period` so the noise tiles. */
function makeNoise(seed) {
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  /** Value noise in [0, 1] at (x, y) on a lattice `period` cells wide, repeating every `period`. */
  return (x, y, period) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = fade(x - xi);
    const fy = fade(y - yi);
    const w = (v) => ((v % period) + period) % period;
    const a = hash(w(xi), w(yi));
    const b = hash(w(xi + 1), w(yi));
    const c = hash(w(xi), w(yi + 1));
    const d = hash(w(xi + 1), w(yi + 1));
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

/** Fractal noise over `octaves`, starting `cells` lattice cells across the tile; tiles seamlessly. */
function fbm(noise, u, v, cells, octaves, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let period = cells;
  for (let o = 0; o < octaves; o++) {
    sum += noise(u * period, v * period, period) * amp;
    norm += amp;
    amp *= gain;
    period *= 2;
  }
  return sum / norm;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A wash overlay: domain-warped fractal noise for the uneven pigment, with
 * blooms (pale centers, dark cauliflower rims) where a second noise crosses a
 * threshold. Positive values darken with `pigment`, negative ones lighten.
 */
function washField(size, seed, { cells = 3, blooms = 0.5, bloomCells = 2, contrast = 1 }) {
  const n1 = makeNoise(seed);
  const n2 = makeNoise(seed + 101);
  const n3 = makeNoise(seed + 202);
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Warp by whole lattice cells' worth of a coarser noise, still periodic on the tile.
      const wu = u + (fbm(n2, u, v, 2, 3) - 0.5) * 0.35;
      const wv = v + (fbm(n3, u, v, 2, 3) - 0.5) * 0.35;
      const mottle = fbm(n1, wu, wv, cells, 5, 0.55) - 0.5;
      const fine = fbm(n2, u, v, cells * 8, 2) - 0.5;
      const b = fbm(n3, wu, wv, bloomCells, 4, 0.6);
      const inside = smoothstep(0.56, 0.6, b);
      const rim = Math.exp(-(((b - 0.58) / 0.018) ** 2));
      let value = mottle * 1.6 * contrast + fine * 0.25;
      value = value * (1 - inside * blooms) - inside * blooms * 0.55 + rim * blooms * 0.7;
      field[y * size + x] = value;
    }
  }
  return field;
}

/** RGBA for a field: pigment where it's positive, `light` where it's negative. */
function overlay(field, size, pigment, light, maxDark, maxLight) {
  const data = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = field[i];
    const color = v >= 0 ? pigment : light;
    const alpha = v >= 0 ? Math.min(1, v) * maxDark : Math.min(1, -v) * maxLight;
    data.set([color[0], color[1], color[2], Math.round(Math.min(1, alpha) * 255)], i * 4);
  }
  return data;
}

/** Paper tooth: fine speckle in light and shade, a little stronger in a coarse cold-press weave. */
function grain(size, seed) {
  const n = makeNoise(seed);
  const m = makeNoise(seed + 7);
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const tooth = fbm(n, u, v, 48, 2) - 0.5;
      const speck = m(u * 160, v * 160, 160) - 0.5;
      const value = tooth * 1.2 + speck * 0.9;
      const dark = value > 0;
      const alpha = Math.min(1, Math.abs(value)) * (dark ? 0.16 : 0.22);
      const color = dark ? [92, 70, 48] : [255, 253, 246];
      data.set([...color, Math.round(alpha * 255)], (y * size + x) * 4);
    }
  }
  return data;
}

const TEXTURES = [
  {
    name: "water",
    size: 256,
    draw: (s) => overlay(washField(s, 11, { cells: 4, blooms: 0.3, bloomCells: 3 }), s, [38, 92, 158], [250, 252, 255], 0.4, 0.3),
  },
  {
    name: "brick",
    size: 256,
    draw: (s) => overlay(washField(s, 23, { cells: 4, blooms: 0.45, bloomCells: 3 }), s, [128, 52, 30], [252, 238, 222], 0.4, 0.3),
  },
  {
    name: "park",
    size: 256,
    draw: (s) => overlay(washField(s, 37, { cells: 3, blooms: 0.5, bloomCells: 3, contrast: 1.2 }), s, [36, 84, 40], [246, 250, 232], 0.5, 0.28),
  },
  {
    name: "paper",
    size: 256,
    draw: (s) => overlay(washField(s, 53, { cells: 2, blooms: 0.3, bloomCells: 2, contrast: 0.7 }), s, [196, 160, 112], [255, 255, 250], 0.16, 0.2),
  },
  { name: "grain", size: 256, draw: (s) => grain(s, 71) },
];

await mkdir(OUT, { recursive: true });
for (const { name, size, draw } of TEXTURES) {
  const file = path.join(OUT, `${name}.webp`);
  const info = await sharp(draw(size), { raw: { width: size, height: size, channels: 4 } })
    .webp({ quality: 80, alphaQuality: 80, effort: 6 })
    .toFile(file);
  console.log(`${path.relative(process.cwd(), file)}  ${(info.size / 1024).toFixed(1)} KB`);
}

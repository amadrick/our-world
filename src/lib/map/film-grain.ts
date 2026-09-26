/** Device-pixel tile. Power of two so the repeat wraps with a bitmask. */
export const FILM_GRAIN_SIZE = 256;

/**
 * A seamless, fine film grain: one byte per texel, centered near mid-grey.
 * The repeat is exact (each sample's neighbors wrap), so a GPU texture of it
 * doesn't show a seam. High frequency on purpose: at device resolution a speck
 * stays about one physical pixel, instead of a soft blob.
 */
export function filmGrainPixels(seed = 5): Uint8Array {
  const size = FILM_GRAIN_SIZE;
  const mask = size - 1;
  const data = new Uint8Array(size * size);
  const hash = (x: number, y: number) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
  };
  for (let y = 0; y < size; y++) {
    const y1 = (y + 1) & mask;
    for (let x = 0; x < size; x++) {
      const x1 = (x + 1) & mask;
      const blurred = (hash(x, y) + hash(x1, y) + hash(x, y1) + hash(x1, y1)) >>> 2;
      data[y * size + x] = blurred & 255;
    }
  }
  return data;
}

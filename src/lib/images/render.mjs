// Rendering and saving place stills. Shared by `npm run images` and the admin.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const IMAGE_SIZE = 960;

/**
 * Place image generation is paused while Andy and Kirissa pick a new visual
 * direction. Set PLACE_IMAGE_GENERATION=on to render again.
 */
export function imageGenerationEnabled() {
  return process.env.PLACE_IMAGE_GENERATION === "on";
}

export const IMAGE_GENERATION_PAUSED =
  "Place image generation is paused until a new visual direction is chosen.";
export const DEFAULT_IMAGE_MODEL = "gpt-image-1";

export function placesImageDir(root = process.cwd()) {
  return path.join(root, "public", "places");
}

/** Approved stills that anchor the series; sent along so new images match. */
export async function styleReferences(root = process.cwd()) {
  const dir = path.join(root, "scripts", "style-references");
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  return files.map((f) => path.join(dir, f));
}

/**
 * Renders one image with OpenAI Images. With reference images (style anchors
 * or a photo) it uses the edits endpoint, otherwise plain generation.
 */
export async function renderImage(prompt, { images = [], apiKey = process.env.OPENAI_API_KEY } = {}) {
  if (!imageGenerationEnabled()) throw new Error(IMAGE_GENERATION_PAUSED);
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set (add it to .env.local)");
  const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;

  let res;
  if (images.length) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    for (const file of images) {
      const png = await sharp(file).png().toBuffer();
      form.append("image[]", new Blob([png], { type: "image/png" }), `${path.parse(file).name}.png`);
    }
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size: "1024x1024", quality: "medium", n: 1 }),
      signal: AbortSignal.timeout(180_000),
    });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? `OpenAI responded ${res.status}`);
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  return Buffer.from(b64, "base64");
}

/**
 * Saves a square WebP on white as public/places/<id>-<hash>.webp, removes the
 * place's previous image, and returns the new URL path. The content hash in
 * the name keeps browsers and the image optimizer from serving a stale still.
 */
export async function saveImage(input, id, root = process.cwd()) {
  const dir = placesImageDir(root);
  await mkdir(dir, { recursive: true });
  const webp = await sharp(input)
    .flatten({ background: "#ffffff" })
    .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "contain", background: "#ffffff" })
    .webp({ quality: 82 })
    .toBuffer();
  const file = `${id}-${createHash("sha1").update(webp).digest("hex").slice(0, 8)}.webp`;
  const previous = new RegExp(`^${id}(-[0-9a-f]{8})?\\.webp$`);
  for (const old of await readdir(dir)) {
    if (old !== file && previous.test(old)) await rm(path.join(dir, old));
  }
  await writeFile(path.join(dir, file), webp);
  return `/places/${file}`;
}

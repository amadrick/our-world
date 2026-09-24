#!/usr/bin/env node
// Creates the clay-diorama image for each place and records it in data/places.json.
//
//   npm run images                        every place that has no image yet
//   npm run images -- tartine-bakery      specific places (regenerates them)
//   npm run images -- --all               every place
//   npm run images -- zuni --photo ./zuni.jpg    turn your own photo into the style
//   npm run images -- zuni --import ./art.png    use an image made elsewhere
//   npm run images -- --print zuni        show the prompt without calling the API
//
// Generating needs OPENAI_API_KEY (and optionally OPENAI_IMAGE_MODEL, default
// gpt-image-1). Images are saved as public/places/<id>.webp, 960x720.

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { buildPhotoPrompt, buildPrompt, fallbackSubject } from "./place-image-prompt.mjs";

const ROOT = process.cwd();
const PLACES_FILE = process.env.PLACES_FILE || path.join(ROOT, "data", "places.json");
const HINTS_FILE = path.join(ROOT, "data", "place-image-hints.json");
const OUT_DIR = path.join(ROOT, "public", "places");
const WIDTH = 960;
const HEIGHT = 720;

function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function parseArgs(argv) {
  const args = { ids: [], all: false, print: false, photo: null, import: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") args.all = true;
    else if (arg === "--print") args.print = true;
    else if (arg === "--photo") args.photo = argv[++i];
    else if (arg === "--import") args.import = argv[++i];
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else args.ids.push(arg);
  }
  if ((args.photo || args.import) && args.ids.length !== 1) {
    throw new Error("--photo and --import work on exactly one place id");
  }
  return args;
}

async function saveWebp(input, id) {
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${id}.webp`);
  await sharp(input).resize(WIDTH, HEIGHT, { fit: "cover" }).webp({ quality: 80 }).toFile(file);
  return `/places/${id}.webp`;
}

async function openaiImage(prompt, photoPath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set (add it to .env.local)");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

  let res;
  if (photoPath) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", "1536x1024");
    form.append("image", new Blob([await readFile(photoPath)]), path.basename(photoPath));
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size: "1536x1024", quality: "medium", n: 1 }),
    });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? `OpenAI responded ${res.status}`);
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  return Buffer.from(b64, "base64");
}

loadEnvLocal();
const args = parseArgs(process.argv.slice(2));
const data = JSON.parse(await readFile(PLACES_FILE, "utf8"));
const hints = existsSync(HINTS_FILE) ? JSON.parse(await readFile(HINTS_FILE, "utf8")) : {};

const byId = new Map(data.places.map((p) => [p.id, p]));
for (const id of args.ids) if (!byId.has(id)) throw new Error(`No place with id "${id}"`);

const targets = args.ids.length
  ? args.ids.map((id) => byId.get(id))
  : data.places.filter((p) => args.all || !p.image);

if (targets.length === 0) {
  console.log("Every place already has an image. Pass ids or --all to regenerate.");
  process.exit(0);
}

let failures = 0;
for (const place of targets) {
  const subject = hints[place.id] ?? fallbackSubject(place);
  const prompt = args.photo ? buildPhotoPrompt(subject) : buildPrompt(subject);
  if (args.print) {
    console.log(`\n# ${place.id}\n${prompt}`);
    continue;
  }
  try {
    const input = args.import ? await readFile(args.import) : await openaiImage(prompt, args.photo);
    place.image = await saveWebp(input, place.id);
    await writeFile(PLACES_FILE, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`✓ ${place.id} → ${place.image}`);
  } catch (error) {
    failures++;
    console.error(`✗ ${place.id}: ${error.message}`);
  }
}
if (failures) process.exit(1);

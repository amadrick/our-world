#!/usr/bin/env node
// Draws each place's image from Andy's prompt (src/lib/images/kodak-place-prompt.md,
// verbatim, with the place name and city filled in) plus the place's research
// notes, and records it in data/places.json.
//
//   npm run images                          every place that has no image yet
//   npm run images -- tartine-bakery        specific places (redraws them)
//   npm run images -- --all                 every place
//   npm run images -- --print zuni          show the full prompt without calling the API
//   npm run images -- --all --out ./prompts write each full prompt to ./prompts/<id>.txt
//   npm run images -- zuni --photo ./zuni.jpg      also send your own photo of the place
//   npm run images -- zuni --import ./art.png      use an image made elsewhere
//   npm run images -- --all --import-dir ./art     use ./art/<id>.png (or .jpg/.webp) per place
//
// Drawing needs OPENAI_API_KEY (and optionally OPENAI_IMAGE_MODEL, default
// gpt-image-1) and PLACE_IMAGE_GENERATION=on. Notes that mention food or drink
// are refused. Output: public/places/<id>-<hash>.webp, 960x960.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildPrompt, readPromptTemplate } from "../src/lib/images/prompt.mjs";
import { renderImage, saveImage } from "../src/lib/images/render.mjs";
import { loadEnvLocal } from "./load-env.mjs";

const ROOT = process.cwd();
const PLACES_FILE = process.env.PLACES_FILE || path.join(ROOT, "data", "places.json");

function parseArgs(argv) {
  const args = { ids: [], all: false, print: false, out: null, photo: null, import: null, importDir: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") args.all = true;
    else if (arg === "--print") args.print = true;
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--photo") args.photo = argv[++i];
    else if (arg === "--import") args.import = argv[++i];
    else if (arg === "--import-dir") args.importDir = argv[++i];
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else args.ids.push(arg);
  }
  if ((args.photo || args.import) && args.ids.length !== 1) {
    throw new Error("--photo and --import work on exactly one place id");
  }
  return args;
}

function importedFile(dir, id) {
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const file = path.join(dir, `${id}.${ext}`);
    if (existsSync(file)) return file;
  }
  return null;
}

loadEnvLocal(ROOT);
const args = parseArgs(process.argv.slice(2));
const data = JSON.parse(await readFile(PLACES_FILE, "utf8"));
const template = readPromptTemplate(ROOT);

const byId = new Map(data.places.map((p) => [p.id, p]));
for (const id of args.ids) if (!byId.has(id)) throw new Error(`No place with id "${id}"`);

const targets = args.ids.length
  ? args.ids.map((id) => byId.get(id))
  : data.places.filter((p) => args.all || !p.image);

if (targets.length === 0) {
  console.log("Every place already has an image. Pass ids or --all to redraw.");
  process.exit(0);
}
if (args.out) await mkdir(args.out, { recursive: true });

let failures = 0;
for (const place of targets) {
  try {
    const prompt = buildPrompt(place, { template, photo: Boolean(args.photo) });
    if (args.print) {
      console.log(`\n# ${place.id}\n${prompt}`);
      continue;
    }
    if (args.out) {
      await writeFile(path.join(args.out, `${place.id}.txt`), prompt);
      console.log(`✓ ${place.id} → ${path.join(args.out, `${place.id}.txt`)}`);
      continue;
    }
    let input;
    if (args.importDir) {
      const file = importedFile(args.importDir, place.id);
      if (!file) throw new Error(`No image for it in ${args.importDir}`);
      input = await readFile(file);
    } else if (args.import) {
      input = await readFile(args.import);
    } else {
      input = await renderImage(prompt, { images: args.photo ? [args.photo] : [] });
    }
    place.image = await saveImage(input, place.id, ROOT);
    await writeFile(PLACES_FILE, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`✓ ${place.id} → ${place.image}`);
  } catch (error) {
    failures++;
    console.error(`✗ ${place.id}: ${error.message}`);
  }
}
if (failures) process.exit(1);

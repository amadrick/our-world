#!/usr/bin/env node
// Creates the clay still of each place's signature subject and records it in
// data/places.json.
//
//   npm run images                        every place that has no image yet
//   npm run images -- tartine-bakery      specific places (regenerates them)
//   npm run images -- --all               every place
//   npm run images -- zuni --photo ./zuni.jpg    turn your own photo into the style
//   npm run images -- zuni --import ./art.png    use an image made elsewhere
//   npm run images -- --print zuni        show the prompt without calling the API
//   npm run images -- zuni --refs         also send the style reference images
//
// Generating needs OPENAI_API_KEY (and optionally OPENAI_IMAGE_MODEL, default
// gpt-image-1). The locked prompt alone keeps the series consistent; --refs
// adds the stills in scripts/style-references/ as anchors, but models tend to
// copy props from them (a spoon, a tap handle), so check the result. Output:
// public/places/<id>.webp, 960x960. Hand-written hints in
// data/place-image-hints.json override the default subject, which comes from
// each place's signatureSubject.

import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildPhotoPrompt,
  buildPrompt,
  buildReferencePrompt,
  fallbackHint,
} from "../src/lib/images/prompt.mjs";
import { renderImage, saveImage, styleReferences } from "../src/lib/images/render.mjs";

const ROOT = process.cwd();
const PLACES_FILE = process.env.PLACES_FILE || path.join(ROOT, "data", "places.json");
const HINTS_FILE = path.join(ROOT, "data", "place-image-hints.json");

function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function parseArgs(argv) {
  const args = { ids: [], all: false, print: false, refs: false, photo: null, import: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") args.all = true;
    else if (arg === "--print") args.print = true;
    else if (arg === "--refs") args.refs = true;
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

const refs = args.refs && !args.photo && !args.import ? await styleReferences(ROOT) : [];

let failures = 0;
for (const place of targets) {
  const hint = { ...fallbackHint(place), ...hints[place.id] };
  const prompt = args.photo
    ? buildPhotoPrompt(hint)
    : refs.length
      ? buildReferencePrompt(hint)
      : buildPrompt(hint);
  if (args.print) {
    console.log(`\n# ${place.id}\n${prompt}`);
    continue;
  }
  try {
    const input = args.import
      ? await readFile(args.import)
      : await renderImage(prompt, { images: args.photo ? [args.photo] : refs });
    place.image = await saveImage(input, place.id, ROOT);
    await writeFile(PLACES_FILE, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`✓ ${place.id} → ${place.image}`);
  } catch (error) {
    failures++;
    console.error(`✗ ${place.id}: ${error.message}`);
  }
}
if (failures) process.exit(1);

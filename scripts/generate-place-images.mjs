#!/usr/bin/env node
// Creates the clay still of each place (its facade or a room, never food) and
// records it in data/places.json.
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
// gpt-image-1) and PLACE_IMAGE_GENERATION=on. What's drawn comes from each
// place's placeVisualSubject; briefs that mention food or drink are refused.
// --refs adds any stills in scripts/style-references/ as style anchors.
// Output: public/places/<id>-<hash>.webp, 960x960.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildPhotoPrompt,
  buildPrompt,
  buildReferencePrompt,
  placeVisual,
} from "../src/lib/images/prompt.mjs";
import { renderImage, saveImage, styleReferences } from "../src/lib/images/render.mjs";
import { loadEnvLocal } from "./load-env.mjs";

const ROOT = process.cwd();
const PLACES_FILE = process.env.PLACES_FILE || path.join(ROOT, "data", "places.json");

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

loadEnvLocal(ROOT);
const args = parseArgs(process.argv.slice(2));
const data = JSON.parse(await readFile(PLACES_FILE, "utf8"));

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
  const visual = placeVisual(place);
  try {
    const prompt = args.photo
      ? buildPhotoPrompt(visual)
      : refs.length
        ? buildReferencePrompt(visual)
        : buildPrompt(visual);
    if (args.print) {
      console.log(`\n# ${place.id}\n${prompt}`);
      continue;
    }
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

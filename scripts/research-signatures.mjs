#!/usr/bin/env node
// Researches what each place is known for and records it in data/places.json
// (signatureSubject, signatureRationale), plus an illustration brief of its
// facade or a room (placeVisualSubject, placeVisualScene) for `npm run images`.
//
//   npm run signatures                     places without a signature yet
//   npm run signatures -- toronado         specific places (re-researches them)
//   npm run signatures -- --all            every place
//   npm run signatures -- --images         also draw each place's still (needs PLACE_IMAGE_GENERATION=on)
//   npm run signatures -- --dry-run        print findings without saving
//
// Needs OPENAI_API_KEY (and optionally OPENAI_MODEL). Uses OpenAI web search,
// falling back to the model's own knowledge (flagged) if search isn't available.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { researchSignature } from "../src/lib/ai/signature-research.mjs";
import { buildPrompt, placeVisual } from "../src/lib/images/prompt.mjs";
import { renderImage, saveImage } from "../src/lib/images/render.mjs";
import { loadEnvLocal } from "./load-env.mjs";

const ROOT = process.cwd();
const PLACES_FILE = process.env.PLACES_FILE || path.join(ROOT, "data", "places.json");

const args = { ids: [], all: false, images: false, dryRun: false };
for (const arg of process.argv.slice(2)) {
  if (arg === "--all") args.all = true;
  else if (arg === "--images") args.images = true;
  else if (arg === "--dry-run") args.dryRun = true;
  else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
  else args.ids.push(arg);
}

loadEnvLocal(ROOT);
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set (add it to .env.local). Nothing was researched.");
  process.exit(1);
}

const data = JSON.parse(await readFile(PLACES_FILE, "utf8"));
const byId = new Map(data.places.map((p) => [p.id, p]));
for (const id of args.ids) if (!byId.has(id)) throw new Error(`No place with id "${id}"`);

const targets = args.ids.length
  ? args.ids.map((id) => byId.get(id))
  : data.places.filter((p) => args.all || !p.signatureSubject);
if (targets.length === 0) {
  console.log("Every place already has a signature. Pass ids or --all to re-research.");
  process.exit(0);
}

const save = async () => {
  if (args.dryRun) return;
  await writeFile(PLACES_FILE, `${JSON.stringify(data, null, 2)}\n`);
};

let unresolved = 0;
for (const place of targets) {
  const found = await researchSignature(place);
  if (found.placeVisualSubject) {
    place.placeVisualSubject = found.placeVisualSubject;
    place.placeVisualScene = found.placeVisualScene;
  }
  if (!found.signatureSubject) {
    unresolved++;
    console.log(`? ${place.id}: ${found.notice}`);
    await save();
    continue;
  }
  const flag = found.source === "model" ? " (no web search, double-check)" : "";
  console.log(`✓ ${place.id}: ${found.signatureSubject}${flag}\n    ${found.signatureRationale ?? ""}`);
  if (found.placeVisualSubject) console.log(`    picture: ${found.placeVisualScene}, ${found.placeVisualSubject}`);

  place.signatureSubject = found.signatureSubject;
  place.signatureRationale = found.signatureRationale;
  await save();

  if (args.images && !args.dryRun) {
    try {
      place.image = await saveImage(await renderImage(buildPrompt(placeVisual(place))), place.id, ROOT);
      await save();
      console.log(`    drew ${place.image}`);
    } catch (error) {
      console.error(`    couldn't draw the still: ${error.message}`);
    }
  }
}
if (unresolved) {
  console.log(`\n${unresolved} place(s) still need a signature. Type them in /admin.`);
  process.exit(1);
}

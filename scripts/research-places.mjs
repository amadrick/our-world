#!/usr/bin/env node
// Researches each place and records it in data/places.json: what it's known
// for (signatureSubject, signatureRationale) and what it physically looks like
// (placeResearch: street, terrain, architecture, iconic details, sources),
// which `npm run images` appends to the image prompt.
//
//   npm run research                       places missing a signature or research
//   npm run research -- toronado           specific places (re-researches them)
//   npm run research -- --all              every place
//   npm run research -- --images           also draw each place's image (needs PLACE_IMAGE_GENERATION=on)
//   npm run research -- --dry-run          print findings without saving
//
// Needs OPENAI_API_KEY (and optionally OPENAI_MODEL). Uses OpenAI web search,
// falling back to the model's own knowledge (flagged) if search isn't available.
// Refresh data/places.md afterwards with `npm run signatures:export`.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { researchPlace } from "../src/lib/ai/place-research.mjs";
import { buildPrompt } from "../src/lib/images/prompt.mjs";
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
  : data.places.filter((p) => args.all || !p.signatureSubject || !p.placeResearch);
if (targets.length === 0) {
  console.log("Every place is researched. Pass ids or --all to re-research.");
  process.exit(0);
}

const save = async () => {
  if (args.dryRun) return;
  await writeFile(PLACES_FILE, `${JSON.stringify(data, null, 2)}\n`);
};

let unresolved = 0;
for (const place of targets) {
  const found = await researchPlace(place);
  const flag = found.source === "model" ? " (no web search, double-check)" : "";
  if (found.placeResearch) {
    place.placeResearch = found.placeResearch;
    console.log(`✓ ${place.id}: ${found.placeResearch.view}; ${found.placeResearch.iconic.join("; ")}${flag}`);
  } else {
    console.log(`? ${place.id}: no physical research found`);
  }
  if (found.signatureSubject) {
    place.signatureSubject = found.signatureSubject;
    place.signatureRationale = found.signatureRationale;
    console.log(`    known for: ${found.signatureSubject}`);
  } else if (!place.signatureSubject) {
    unresolved++;
    console.log(`    ${found.notice}`);
  }
  await save();

  if (args.images && !args.dryRun) {
    try {
      place.image = await saveImage(await renderImage(buildPrompt(place)), place.id, ROOT);
      await save();
      console.log(`    drew ${place.image}`);
    } catch (error) {
      console.error(`    couldn't draw the image: ${error.message}`);
    }
  }
}
if (unresolved) {
  console.log(`\n${unresolved} place(s) still need a signature. Type them in /admin.`);
  process.exit(1);
}

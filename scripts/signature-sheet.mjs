#!/usr/bin/env node
// data/signatures.json is the review sheet for what each place is known for:
// subject, one-line rationale, confidence, sources, and an `approved` flag.
//
//   npm run signatures:apply               copy edited subjects/rationales into data/places.json
//   npm run signatures:apply -- --images   ...and redraw the stills of the places that changed
//   npm run signatures:export              refresh the sheet from data/places.json (keeps review marks)
//
// A changed subject drops that place's hand-written image hint, so its new
// still is drawn from the edited subject.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildPrompt, fallbackHint } from "../src/lib/images/prompt.mjs";
import { renderImage, saveImage } from "../src/lib/images/render.mjs";
import { loadEnvLocal } from "./load-env.mjs";

const ROOT = process.cwd();
const PLACES_FILE = process.env.PLACES_FILE || path.join(ROOT, "data", "places.json");
const SHEET_FILE = path.join(ROOT, "data", "signatures.json");
const HINTS_FILE = path.join(ROOT, "data", "place-image-hints.json");

const [command, ...flags] = process.argv.slice(2);
const readJson = async (file, fallback) =>
  existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : fallback;
const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);

const data = await readJson(PLACES_FILE, { places: [] });
const sheet = await readJson(SHEET_FILE, { places: [] });

if (command === "export") {
  const previous = new Map(sheet.places.map((e) => [e.id, e]));
  sheet.places = data.places.map((p) => {
    const old = previous.get(p.id);
    return {
      id: p.id,
      name: p.name,
      signatureSubject: p.signatureSubject ?? "",
      signatureRationale: p.signatureRationale ?? "",
      confidence: old?.signatureSubject === p.signatureSubject ? old.confidence : "unreviewed",
      sources: old?.sources ?? [],
      approved: old?.signatureSubject === p.signatureSubject ? Boolean(old.approved) : false,
    };
  });
  await writeJson(SHEET_FILE, sheet);
  console.log(`Wrote ${sheet.places.length} places to data/signatures.json`);
} else if (command === "apply") {
  loadEnvLocal(ROOT);
  const hints = await readJson(HINTS_FILE, {});
  const byId = new Map(data.places.map((p) => [p.id, p]));
  const changed = [];
  for (const entry of sheet.places) {
    const place = byId.get(entry.id);
    if (!place) {
      console.warn(`? ${entry.id} is in the sheet but not in data/places.json`);
      continue;
    }
    const subject = entry.signatureSubject.trim() || undefined;
    const rationale = entry.signatureRationale.trim() || undefined;
    if (subject !== place.signatureSubject) {
      changed.push(place);
      delete hints[place.id];
    }
    place.signatureSubject = subject;
    place.signatureRationale = rationale;
  }
  await writeJson(PLACES_FILE, data);
  await writeJson(HINTS_FILE, hints);
  const approved = sheet.places.filter((e) => e.approved).length;
  console.log(`Applied the sheet: ${approved}/${sheet.places.length} approved, ${changed.length} subject(s) changed.`);
  for (const place of changed) console.log(`  ${place.id}: ${place.signatureSubject ?? "(none)"}`);

  if (changed.length && flags.includes("--images")) {
    for (const place of changed) {
      try {
        place.image = await saveImage(await renderImage(buildPrompt(fallbackHint(place))), place.id, ROOT);
        await writeJson(PLACES_FILE, data);
        console.log(`✓ redrew ${place.id}`);
      } catch (error) {
        console.error(`✗ ${place.id}: ${error.message}`);
      }
    }
  } else if (changed.length) {
    console.log(`Redraw them with: npm run images -- ${changed.map((p) => p.id).join(" ")}`);
  }
} else {
  console.error("Usage: npm run signatures:apply [-- --images]  |  npm run signatures:export");
  process.exit(1);
}

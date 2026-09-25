#!/usr/bin/env node
// data/signatures.json is the review sheet for what each place is known for:
// subject, one-line rationale, confidence, sources, and an `approved` flag.
// data/places.md is its readable companion: each place's signature plus its
// physical research (street, terrain, architecture, iconic details, sources).
//
//   npm run signatures:apply               copy edited subjects/rationales into data/places.json
//   npm run signatures:export              refresh the sheet from data/places.json (keeps review marks)
//   npm run places:md                      rewrite data/places.md only
//
// Both sheet commands also rewrite data/places.md.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";


const ROOT = process.cwd();
const PLACES_FILE = process.env.PLACES_FILE || path.join(ROOT, "data", "places.json");
const SHEET_FILE = path.join(ROOT, "data", "signatures.json");
const MARKDOWN_FILE = path.join(ROOT, "data", "places.md");

const [command] = process.argv.slice(2);
const readJson = async (file, fallback) =>
  existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : fallback;
const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);

const data = await readJson(PLACES_FILE, { places: [] });
const sheet = await readJson(SHEET_FILE, { places: [] });

const CATEGORY_LABEL = {
  restaurant: "Restaurant",
  bar: "Bar",
  wine: "Wine",
  coffee: "Coffee",
  bakery: "Bakery",
  dessert: "Dessert",
  activity: "Activity",
  sight: "Sight",
};

function placeMarkdown(place, entry) {
  const r = place.placeResearch;
  const out = [`## ${place.name}`, ""];
  out.push([CATEGORY_LABEL[place.category] ?? place.category, place.neighborhood, place.address].filter(Boolean).join(" · "));
  out.push("");
  if (place.signatureSubject) {
    const confidence = entry?.confidence && entry.confidence !== "unreviewed" ? ` (${entry.confidence} confidence)` : "";
    out.push(`**Known for:** ${place.signatureSubject}${confidence}. ${place.signatureRationale ?? ""}`.trim(), "");
  }
  out.push("### Place research", "");
  if (!r) {
    out.push("Not researched yet. Run `npm run research -- " + place.id + "`.", "");
    return out.join("\n");
  }
  out.push(`- **Neighborhood and street:** ${[place.neighborhood, r.street].filter(Boolean).join(". ")}`);
  out.push(`- **Terrain and setting:** ${r.terrain || "Not found."}`);
  out.push(`- **Architecture:** ${r.architecture || "Not found."}`);
  out.push(`- **Unique architectural notes:** ${r.unique || "Nothing verified."}`);
  out.push("- **Most iconic physical characteristics:**");
  for (const item of r.iconic) out.push(`  - ${item}`);
  out.push(`- **More recognizable view:** ${r.view === "interior" ? "the interior" : "the facade"}`);
  if (r.unverified) out.push(`- **Not verified:** ${r.unverified}`);
  out.push("- **Sources:**");
  for (const url of r.sources) out.push(`  - <${url}>`);
  if (!r.sources.length) out.push("  - None recorded.");
  out.push("");
  return out.join("\n");
}

async function writeMarkdown() {
  const entries = new Map(sheet.places.map((e) => [e.id, e]));
  const places = [...data.places].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const researched = places.filter((p) => p.placeResearch).length;
  const doc = [
    "# Andy and Kirissa's places",
    "",
    `Per-place notes for all ${places.length} places: what each is known for (reviewed in`,
    "`data/signatures.json`) and what it physically looks like. The place research is",
    "appended to the image prompt as reference notes, so each picture is of the real",
    `place. ${researched} of ${places.length} places are researched.`,
    "",
    "Generated from `data/places.json` by `npm run places:md`. Edit places in `/admin`",
    "or the JSON, then regenerate; edits made here are overwritten.",
    "",
    ...places.map((p) => placeMarkdown(p, entries.get(p.id))),
  ].join("\n");
  await writeFile(MARKDOWN_FILE, doc);
  console.log(`Wrote ${places.length} places to data/places.md`);
}

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
  await writeMarkdown();
} else if (command === "markdown") {
  await writeMarkdown();
} else if (command === "apply") {
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
    if (subject !== place.signatureSubject) changed.push(place);
    place.signatureSubject = subject;
    place.signatureRationale = rationale;
  }
  await writeJson(PLACES_FILE, data);
  const approved = sheet.places.filter((e) => e.approved).length;
  console.log(`Applied the sheet: ${approved}/${sheet.places.length} approved, ${changed.length} subject(s) changed.`);
  for (const place of changed) console.log(`  ${place.id}: ${place.signatureSubject ?? "(none)"}`);
  await writeMarkdown();
} else {
  console.error("Usage: npm run signatures:apply  |  npm run signatures:export  |  npm run places:md");
  process.exit(1);
}

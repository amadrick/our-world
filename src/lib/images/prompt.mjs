// Builds the image prompt for a place: Andy's prompt from kodak-place-prompt.md,
// verbatim except for the place name and city, followed by a separate block of
// reference notes from the place's research. Shared by `npm run images` and the
// admin. Server only (reads the template from disk).

import { readFileSync } from "node:fs";
import path from "node:path";

import { assertNoFood } from "./food-guard.mjs";

export const PROMPT_TEMPLATE_FILE = path.join("src", "lib", "images", "kodak-place-prompt.md");
export const CITY = "San Francisco";

export function readPromptTemplate(root = process.cwd()) {
  return readFileSync(path.join(root, PROMPT_TEMPLATE_FILE), "utf8");
}

/** The template with its two placeholders filled in. Nothing else changes. */
export function fillTemplate(template, name) {
  return template.replaceAll("[RESTAURANT NAME]", name).replaceAll("[CITY]", CITY);
}

/**
 * The place-specific block appended after the prompt: where it is, and what the
 * research found about its street, terrain, and architecture.
 */
export function referenceNotes(place, { photo = false } = {}) {
  const r = place.placeResearch;
  const neighborhood = [place.neighborhood, r?.street].filter(Boolean).join(". ");
  // No street address: image models paint it onto walls as invented signage.
  const lines = [
    neighborhood && `Neighborhood and street: ${neighborhood}`,
    r?.terrain && `Terrain and setting: ${r.terrain}`,
    r?.architecture && `Architecture: ${r.architecture}`,
    r?.unique && `Unique architectural notes: ${r.unique}`,
    r?.iconic?.length && `Most iconic physical characteristics: ${r.iconic.join("; ")}`,
    r?.view && `Most recognizable view: ${r.viewNote || `the ${r.view}`}`,
    photo && "Reference photo: the attached photo shows the real place. Use it for its architecture and layout only.",
  ].filter(Boolean);
  return lines.length ? ["Reference notes for this place:", ...lines.map((line) => `- ${line}`)].join("\n") : "";
}

/** The full prompt as sent. Throws if the reference notes describe food or drink. */
export function buildPrompt(place, { template = readPromptTemplate(), photo = false } = {}) {
  const notes = referenceNotes(place, { photo });
  assertNoFood(notes);
  const prompt = fillTemplate(template, place.name);
  if (!notes) return prompt;
  return `${prompt}${prompt.endsWith("\n") ? "" : "\n"}\n---\n\n${notes}\n`;
}

// Finds what a place is known for (its signature dish, drink, or room) and
// proposes a brief for its illustration: the facade or a room, never food.
// Shared by the admin add flow and `npm run signatures`.

import { foodIn } from "../images/prompt.mjs";
import { textModel } from "./models.mjs";

const INSTRUCTIONS = `You research San Francisco Bay Area restaurants, bars, and cafés for a wedding-week guide.
Find what guests and regulars treat as the place's signature: an iconic dish or drink, or, when the space itself is the draw, an interior, ritual, or exterior quirk.
Prefer primary and well-known sources: the venue's own site and menu, Infatuation, Eater, SF Chronicle, Michelin, and review consensus. Never invent secret-menu lore or a dish you didn't find.
signatureSubject: a short noun phrase in sentence case, like "Morning bun" or "Salt & pepper Dungeness crab".
signatureRationale: one line on why, naming where that comes from, like "Eater and the menu call it the house classic."
placeVisualSubject: one sentence describing the place itself for a small clay model of it: its street facade or storefront (materials, colors, awning, windows, signage), or its signature room, patio, or courtyard. Architecture and furniture only: never food, drinks, plates, cups, glasses, or bottles, even if the signature is a dish. If the facade has a sign, end with: with a simple crisp sign that reads "NAME".
placeVisualScene: "interior" only when the room itself is the draw, otherwise "facade".
If nothing is reliable, return empty strings and "facade".`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["signatureSubject", "signatureRationale", "placeVisualSubject", "placeVisualScene"],
  properties: {
    signatureSubject: { type: "string" },
    signatureRationale: { type: "string" },
    placeVisualSubject: { type: "string" },
    placeVisualScene: { type: "string", enum: ["facade", "interior"] },
  },
};

export const NEEDS_SIGNATURE = "Needs a signature: type what it's known for, or retry with an OpenAI key.";

function describe(place) {
  return [
    `Place: ${place.name}`,
    place.category && `Type: ${place.category}`,
    place.neighborhood && `Neighborhood: ${place.neighborhood}`,
    place.address && `Address: ${place.address}`,
    place.lat != null && place.lng != null && `Coordinates: ${place.lat}, ${place.lng}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function outputText(body) {
  for (const item of body.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text;
    }
  }
  return "";
}

async function ask(place, { apiKey, webSearch }) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: textModel(),
      instructions: INSTRUCTIONS,
      input: describe(place),
      ...(webSearch && { tools: [{ type: "web_search" }] }),
      text: { format: { type: "json_schema", name: "signature", schema: SCHEMA, strict: true } },
    }),
    signal: AbortSignal.timeout(90_000),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? `OpenAI responded ${res.status}`);
  return JSON.parse(outputText(body) || "{}");
}

/**
 * Researches a place's signature and an illustration brief. Tries OpenAI with
 * web search, falls back to the model's own knowledge (flagged for a
 * double-check), and without a key returns a clear "needs signature" notice
 * instead of guessing. A brief that mentions food is dropped.
 *
 * @returns {Promise<{ signatureSubject?: string, signatureRationale?: string,
 *   placeVisualSubject?: string, placeVisualScene?: "facade" | "interior",
 *   source: "web" | "model" | "none", notice?: string }>}
 */
export async function researchSignature(place, { apiKey = process.env.OPENAI_API_KEY } = {}) {
  if (!apiKey) return { source: "none", notice: NEEDS_SIGNATURE };

  let source = "web";
  let notice;
  let found;
  try {
    found = await ask(place, { apiKey, webSearch: true });
  } catch (error) {
    console.error("Signature web search failed:", error.message);
    try {
      found = await ask(place, { apiKey, webSearch: false });
      source = "model";
      notice = "Web search wasn't available, so this is the model's best guess. Double-check it.";
    } catch (fallbackError) {
      console.error("Signature research failed:", fallbackError.message);
      return { source: "none", notice: `Couldn't look it up (${fallbackError.message}). ${NEEDS_SIGNATURE}` };
    }
  }

  let placeVisualSubject = found.placeVisualSubject?.trim() || undefined;
  if (placeVisualSubject && foodIn(placeVisualSubject)) placeVisualSubject = undefined;
  const placeVisual = placeVisualSubject && {
    placeVisualSubject,
    placeVisualScene: found.placeVisualScene === "interior" ? "interior" : "facade",
  };

  const signatureSubject = found.signatureSubject?.trim();
  if (!signatureSubject) return { ...placeVisual, source, notice: NEEDS_SIGNATURE };
  return {
    signatureSubject,
    signatureRationale: found.signatureRationale?.trim() || undefined,
    ...placeVisual,
    source,
    notice,
  };
}

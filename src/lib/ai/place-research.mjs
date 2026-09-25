// Researches a place for the guide: what it's known for (its signature dish,
// drink, or room) and what it physically looks like (street, terrain,
// architecture, iconic details) so its image is of this place, not a generic
// storefront. Shared by the admin add flow and `npm run research`.

import { foodIn } from "../images/food-guard.mjs";
import { textModel } from "./models.mjs";

const INSTRUCTIONS = `You research San Francisco Bay Area restaurants, bars, and cafés for a wedding-week guide. For the place given, find two things.
1. Its signature: what guests and regulars treat as the place's thing, an iconic dish or drink, or, when the space itself is the draw, an interior, ritual, or exterior quirk. Never invent secret-menu lore or a dish you didn't find.
2. What the place physically looks like, so an image of it is recognizably this place and not a generic storefront. Use the venue's own site, press (Eater, SF Chronicle, Infatuation, Michelin), and listing photo captions. Never invent features; say what you couldn't verify.
signatureSubject: a short noun phrase in sentence case, like "Morning bun" or "Salt & pepper Dungeness crab".
signatureRationale: one line on why, naming where that comes from, like "Eater and the menu call it the house classic."
street: the immediate street context in 1-3 sentences: block character, corner or mid-block, what's adjacent (neighboring buildings, alley, pier, park edge), cross street.
terrain: 1-2 sentences: hill or flat, street grade, waterfront, fog, view lines, street trees, light.
architecture: 2-4 sentences: building type and era, materials, facade color, windows, awning, signage and lettering style, entrance, patio or courtyard.
unique: 1-2 sentences on anything physically one of a kind, or say plainly that nothing stands out.
iconic: 2-4 short phrases, the physical details a regular would recognize it by.
view: "interior" when the room is more recognizable than the facade, otherwise "facade".
sources: the URLs you used.
unverified: what you couldn't verify, or "".
In street, terrain, architecture, unique, and iconic describe the building and rooms only. Never use food or drink words (dishes, drinks, bottles, cups, pastries), except inside double-quoted sign lettering like "COLD BEER".
If nothing is reliable, return empty strings and arrays and "facade".`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "signatureSubject",
    "signatureRationale",
    "street",
    "terrain",
    "architecture",
    "unique",
    "iconic",
    "view",
    "sources",
    "unverified",
  ],
  properties: {
    signatureSubject: { type: "string" },
    signatureRationale: { type: "string" },
    street: { type: "string" },
    terrain: { type: "string" },
    architecture: { type: "string" },
    unique: { type: "string" },
    iconic: { type: "array", items: { type: "string" } },
    view: { type: "string", enum: ["facade", "interior"] },
    sources: { type: "array", items: { type: "string" } },
    unverified: { type: "string" },
  },
};

export const NEEDS_SIGNATURE = "Needs a signature: type what it's known for, or retry with an OpenAI key.";
const FROM_MEMORY = "From the model's memory, not a web search; check it against photos.";

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

function outputMessage(body) {
  for (const item of body.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) {
        const cited = (part.annotations ?? []).filter((a) => a.type === "url_citation").map((a) => a.url);
        return { text: part.text, cited };
      }
    }
  }
  return { text: "", cited: [] };
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
      text: { format: { type: "json_schema", name: "place_research", schema: SCHEMA, strict: true } },
    }),
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message ?? `OpenAI responded ${res.status}`);
  const { text, cited } = outputMessage(body);
  return { ...JSON.parse(text || "{}"), cited };
}

/** Drops any sentence that talks about food or drink; the rest still helps the image. */
export function withoutFood(text) {
  return (text ?? "")
    .split(/(?<=[.;!?])\s+/)
    .filter((sentence) => sentence.trim() && !foodIn(sentence))
    .join(" ")
    .trim();
}

function isUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** The physical research as stored on a place, or undefined if nothing usable came back. */
export function toPlaceResearch(found, { fromMemory = false } = {}) {
  const research = {
    street: withoutFood(found.street),
    terrain: withoutFood(found.terrain),
    architecture: withoutFood(found.architecture),
    unique: withoutFood(found.unique),
    iconic: (found.iconic ?? [])
      .map((item) => item.trim())
      .filter((item) => item && !foodIn(item))
      .slice(0, 4),
    view: found.view === "interior" ? "interior" : "facade",
    sources: [...new Set([...(found.sources ?? []), ...(found.cited ?? [])].map((s) => s.trim()))]
      .filter(isUrl)
      .slice(0, 8),
    unverified: [fromMemory && FROM_MEMORY, found.unverified?.trim()].filter(Boolean).join(" ") || undefined,
  };
  if (!research.architecture && research.iconic.length === 0) return undefined;
  return research;
}

/**
 * Researches a place's signature and physical character. Tries OpenAI with web
 * search, falls back to the model's own knowledge (flagged for a double-check),
 * and without a key returns a clear notice instead of guessing.
 *
 * @returns {Promise<{ signatureSubject?: string, signatureRationale?: string,
 *   placeResearch?: import("../places/types").PlaceResearch,
 *   source: "web" | "model" | "none", notice?: string }>}
 */
export async function researchPlace(place, { apiKey = process.env.OPENAI_API_KEY } = {}) {
  if (!apiKey) return { source: "none", notice: NEEDS_SIGNATURE };

  let source = "web";
  let notice;
  let found;
  try {
    found = await ask(place, { apiKey, webSearch: true });
  } catch (error) {
    console.error("Place research web search failed:", error.message);
    try {
      found = await ask(place, { apiKey, webSearch: false });
      source = "model";
      notice = "Web search wasn't available, so this is the model's best guess. Double-check it.";
    } catch (fallbackError) {
      console.error("Place research failed:", fallbackError.message);
      return { source: "none", notice: `Couldn't look it up (${fallbackError.message}). ${NEEDS_SIGNATURE}` };
    }
  }

  const placeResearch = toPlaceResearch(found, { fromMemory: source === "model" });
  const signatureSubject = found.signatureSubject?.trim();
  if (!signatureSubject) return { placeResearch, source, notice: NEEDS_SIGNATURE };
  return {
    signatureSubject,
    signatureRationale: found.signatureRationale?.trim() || undefined,
    placeResearch,
    source,
    notice,
  };
}

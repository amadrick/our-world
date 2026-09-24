import { getCategory } from "@/lib/places/taxonomy";
import type { CategoryId } from "@/lib/places/types";
import { aiModel } from "./summary";

export interface SignatureRequest {
  name: string;
  category?: CategoryId;
  neighborhood: string;
  address: string;
}

export type ImageScene = "object" | "room";

export interface SignatureResult {
  /** What the place is known for, e.g. "Salt & pepper Dungeness crab". */
  signatureSubject?: string;
  /** A concrete description of it for the illustration. */
  visual?: string;
  scene?: ImageScene;
  source: "ai" | "none";
  notice?: string;
}

const INSTRUCTIONS = `You research San Francisco Bay Area restaurants, bars, and cafés for a wedding-week guide.
Search the web for what the given place is best known for: its signature dish, drink, or, if the space itself is the draw, the room or experience.
Prefer what recent reviews (Infatuation, Eater, SF Chronicle, Michelin) and the venue's own menu single out.
signatureSubject: a short noun phrase, sentence case, like "Morning bun" or "Salt & pepper Dungeness crab". Never invent a dish you didn't find.
visual: one sentence describing that subject concretely enough to sculpt as a small clay model (what's on the plate or in the glass, or what's in the room). No people, no text or logos.
scene: "room" only when the signature is the space itself, otherwise "object".
If you can't find anything reliable, return empty strings and "object".`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["signatureSubject", "visual", "scene"],
  properties: {
    signatureSubject: { type: "string" },
    visual: { type: "string" },
    scene: { type: "string", enum: ["object", "room"] },
  },
};

interface ResponsesOutput {
  output?: { type: string; content?: { type: string; text?: string }[] }[];
  error?: { message?: string };
}

function outputText(body: ResponsesOutput): string {
  for (const item of body.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text;
    }
  }
  return "";
}

/**
 * Looks up what a place is known for with OpenAI web search. Without a key it
 * returns nothing, and the admin types the signature by hand.
 */
export async function researchSignature(req: SignatureRequest): Promise<SignatureResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      source: "none",
      notice: "No OpenAI key is set, so type what it's known for yourself.",
    };
  }

  const place = [
    `Place: ${req.name}`,
    req.category && `Type: ${getCategory(req.category).label}`,
    req.neighborhood && `Neighborhood: ${req.neighborhood}`,
    req.address && `Address: ${req.address}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel(),
        instructions: INSTRUCTIONS,
        input: place,
        tools: [{ type: "web_search" }],
        text: { format: { type: "json_schema", name: "signature", schema: SCHEMA, strict: true } },
      }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as ResponsesOutput;
    if (!res.ok) throw new Error(body.error?.message ?? `OpenAI responded ${res.status}`);

    const parsed = JSON.parse(outputText(body) || "{}") as Partial<Record<keyof typeof SCHEMA.properties, string>>;
    const signatureSubject = parsed.signatureSubject?.trim();
    if (!signatureSubject) {
      return { source: "ai", notice: "Couldn't find a clear signature. Type one if you know it." };
    }
    return {
      signatureSubject,
      visual: parsed.visual?.trim() || undefined,
      scene: parsed.scene === "room" ? "room" : "object",
      source: "ai",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Signature research failed:", reason);
    return { source: "none", notice: `Couldn't look it up (${reason}). Type it yourself or retry.` };
  }
}

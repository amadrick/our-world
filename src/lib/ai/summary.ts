import { getCategory, getTag } from "@/lib/places/taxonomy";
import type { CategoryId, TagId } from "@/lib/places/types";

export interface SummaryRequest {
  name: string;
  category: CategoryId;
  neighborhood: string;
  address: string;
  tags: TagId[];
  note?: string;
}

export interface SummaryResult {
  summary: string;
  source: "ai" | "placeholder";
  /** Explains why a placeholder was used, for the admin. */
  notice?: string;
}

const DEFAULT_MODEL = "gpt-5-mini";

const SYSTEM_PROMPT = `You write short blurbs for a wedding-week guide to San Francisco that the couple shares with their guests.
Write 2-3 sentences (45-70 words) in a warm, confident, plain-spoken voice.
Say what the place is and what it's known for, then add one practical tip only if you're confident it's true (reservations, lines, cash only, best time to go).
Never invent prices, hours, dishes, or other specifics you're unsure about; stay general instead.
If the host left a note, stay consistent with it without repeating it word for word.
No emojis, hashtags, exclamation marks, headings, or quotation marks around the text.`;

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function aiModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

const PLACEHOLDER_SUBJECT: Record<CategoryId, string> = {
  restaurant: "A restaurant",
  bar: "A bar",
  coffee: "A coffee spot",
  activity: "Something to do",
  sight: "A sight worth seeing",
};

/** Plain, clearly generic text used when OpenAI isn't available. */
export function placeholderSummary(req: SummaryRequest): string {
  const where = req.neighborhood || "San Francisco";
  const tags = req.tags.filter((t) => t !== "top-pick").map((t) => getTag(t).badge);
  const extra = tags.length ? ` ${tags.join(" · ")}.` : "";
  return `${PLACEHOLDER_SUBJECT[req.category]} in ${where}.${extra}`;
}

function userPrompt(req: SummaryRequest): string {
  const lines = [
    `Place: ${req.name}`,
    `Category: ${getCategory(req.category).label}`,
    req.neighborhood && `Neighborhood: ${req.neighborhood}`,
    req.address && `Address: ${req.address}`,
    req.tags.length && `Tags: ${req.tags.map((t) => getTag(t).badge).join(", ")}`,
    req.note && `Host's note: ${req.note}`,
  ];
  return lines.filter(Boolean).join("\n");
}

function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model);
}

export async function generateSummary(req: SummaryRequest): Promise<SummaryResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      summary: placeholderSummary(req),
      source: "placeholder",
      notice: "No OpenAI key is set, so this is a placeholder. Edit it or add OPENAI_API_KEY.",
    };
  }

  const model = aiModel();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(req) },
        ],
        ...(isReasoningModel(model) ? { reasoning_effort: "low" } : { temperature: 0.7 }),
      }),
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(body?.error?.message ?? `OpenAI responded ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim().replace(/^"|"$/g, "");
    if (!text) throw new Error("OpenAI returned an empty summary");
    return { summary: text, source: "ai" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("Summary generation failed:", reason);
    return {
      summary: placeholderSummary(req),
      source: "placeholder",
      notice: `Couldn't reach OpenAI (${reason}). Used a placeholder you can edit or retry.`,
    };
  }
}

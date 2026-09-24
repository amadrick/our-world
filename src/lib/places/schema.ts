import { z } from "zod";

import { foodIn } from "@/lib/images/prompt.mjs";
import { CATEGORY_IDS, TAG_IDS } from "./types";

const MAPS_HOSTS = /(^|\.)(apple\.com|maps\.apple|google\.[a-z.]+|goo\.gl)$/i;

const mapsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && MAPS_HOSTS.test(url.hostname);
    } catch {
      return false;
    }
  }, "Must be an Apple Maps or Google Maps link")
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

export const placeInputSchema = z.object({
  name: z.string().trim().min(1, "Add a name").max(120),
  category: z.enum(CATEGORY_IDS, "Pick a category"),
  neighborhood: z.string().trim().max(60).default(""),
  address: z.string().trim().max(200).default(""),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  tags: z
    .array(z.enum(TAG_IDS))
    .default([])
    .transform((tags) => [...new Set(tags)]),
  note: optionalText(1000),
  summary: z.string().trim().max(1500).default(""),
  summarySource: z.enum(["ai", "written", "placeholder"]).default("written"),
  signatureSubject: optionalText(200),
  signatureRationale: optionalText(500),
  placeVisualSubject: optionalText(500).refine((value) => !value || !foodIn(value), {
    message: "Describe the building or room, not food or drink",
  }),
  placeVisualScene: z.enum(["facade", "interior"]).optional(),
  appleMapsUrl: mapsUrl,
  googleMapsUrl: mapsUrl,
  image: z
    .string()
    .regex(/^\/places\/[a-z0-9-]+\.(webp|png|jpe?g)$/, "Must be an image under /places/")
    .optional(),
});

export type PlaceInputPayload = z.input<typeof placeInputSchema>;

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

import { getCategory, getTag, pickLabel } from "./taxonomy";
import type { Place } from "./types";

/**
 * Fuzzy place search, all on the device. Every word typed has to match
 * something about a place: its name, what it is, what to order, where it is, or
 * its description. A name hit outranks a category or order hit, which outranks
 * the description. Words match whole, by their start while typing, and, when
 * nothing matches outright, within a typo or two ("cofee", "taqeria").
 *
 * Concepts ("dim sum") widen the query with a few hand-kept synonyms. They only
 * change what is searched for; nothing is added to the places themselves, so a
 * concept with no real match still finds nothing.
 */

/** Groups of interchangeable searches. Any one of them also searches for the rest. */
export const SEARCH_SYNONYMS: readonly (readonly string[])[] = [
  ["dim sum", "dumplings", "cantonese", "yum cha", "har gow", "shumai", "pot stickers", "xiao long bao"],
  ["boba", "bubble tea", "milk tea"],
  ["cocktails", "cocktail bar", "bar", "speakeasy"],
  ["pastries", "pastry", "bakery", "croissant", "morning bun"],
  ["burrito", "taqueria", "tacos"],
  ["wine", "wine bar", "natural wine"],
  ["espresso", "coffee", "latte", "cafe"],
  ["ice cream", "gelato", "soft serve"],
  ["pizza", "pizzeria"],
  ["ramen", "noodles"],
  ["sushi", "omakase"],
];

export type FieldKind = "name" | "kind" | "place" | "about";

/** How much a word found in each kind of field counts. */
const FIELD_WEIGHT: Record<FieldKind, number> = { name: 10, kind: 6, place: 4, about: 2 };
/** A synonym's match counts for less than the words the guest actually typed. */
const SYNONYM_WEIGHT = 0.7;
/** The words typed run together ("dimsum") or split, matched as one. */
const JOINED_WEIGHT = 0.9;

const QUALITY = { exact: 1, prefix: 0.85, fuzzy: 0.7, fuzzyPrefix: 0.6 } as const;

interface Field {
  kind: FieldKind;
  tokens: string[];
}

export interface SearchDoc {
  id: string;
  fields: Field[];
  /** The name, normalized, for whole-phrase bonuses. */
  name: string;
}

export interface SearchHit {
  id: string;
  score: number;
  /** The strongest kind of field that matched: name hits list first. */
  best: FieldKind;
}

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Plurals fold to the singular, so "dumplings" finds "dumpling" and "bakeries" finds "bakery". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) return word.slice(0, -1);
  return word;
}

function words(text: string): string[] {
  const normalized = normalize(text);
  return normalized ? normalized.split(" ").map(stem) : [];
}

/** A field's words, plus each neighboring pair run together, so "dimsum" finds "dim sum". */
function tokensOf(text: string): string[] {
  const list = words(text);
  const joined = list.slice(1).map((word, i) => list[i] + word);
  return [...list, ...joined];
}

export function buildSearchIndex(places: readonly Place[]): SearchDoc[] {
  return places.map((place) => {
    const category = getCategory(place.category);
    const kind = [
      category.label,
      category.plural,
      ...place.tags.map((tag) => getTag(tag).label),
      pickLabel(place.pickBy) ?? "",
      place.signatureSubject ?? "",
    ].join(" · ");
    const street = place.address.replace(/,?\s*San Francisco.*$/i, "");
    return {
      id: place.id,
      name: normalize(place.name),
      fields: [
        { kind: "name", tokens: tokensOf(place.name) },
        { kind: "kind", tokens: tokensOf(kind) },
        { kind: "place", tokens: tokensOf(`${place.neighborhood} · ${street}`) },
        { kind: "about", tokens: tokensOf(`${place.summary} · ${place.note ?? ""}`) },
      ],
    };
  });
}

/** Edits (insert, delete, substitute, swap two neighbors) between two words, stopping past `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, prev2[j - 2] + 1);
      row.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

/** Typos allowed for a word this long: none for short words, where one edit makes another word. */
function typoBudget(length: number): number {
  return length >= 7 ? 2 : length >= 4 ? 1 : 0;
}

function matchQuality(query: string, token: string, fuzzy: boolean): number {
  if (token === query) return QUALITY.exact;
  if (token.startsWith(query)) return QUALITY.prefix;
  if (!fuzzy) return 0;
  const budget = typoBudget(query.length);
  if (budget === 0 || token[0] !== query[0]) return 0;
  if (editDistance(query, token, budget) <= budget) return QUALITY.fuzzy;
  if (token.length > query.length && editDistance(query, token.slice(0, query.length), 1) <= 1) {
    return QUALITY.fuzzyPrefix;
  }
  return 0;
}

interface WordMatch {
  score: number;
  kind: FieldKind;
}

function matchWord(doc: SearchDoc, word: string, fuzzy: boolean): WordMatch | null {
  let best: WordMatch | null = null;
  for (const field of doc.fields) {
    const weight = FIELD_WEIGHT[field.kind];
    if (best && best.score >= weight) continue;
    let quality = 0;
    for (const token of field.tokens) {
      quality = Math.max(quality, matchQuality(word, token, fuzzy));
      if (quality === 1) break;
    }
    const score = quality * weight;
    if (score > 0 && (!best || score > best.score)) best = { score, kind: field.kind };
  }
  return best;
}

const RANK: Record<FieldKind, number> = { name: 0, kind: 1, place: 2, about: 3 };

/** One way of reading the query: its words, each of which must match, and how much it counts. */
interface Reading {
  words: string[];
  weight: number;
  phrase: string;
  /** Typos are forgiven only in what the guest typed, and not when it's already a known concept. */
  fuzzy: boolean;
}

function readings(query: string): Reading[] {
  const typed = words(query);
  if (typed.length === 0) return [];
  const phrase = typed.join(" ");
  const compact = typed.join("");
  const known = SEARCH_SYNONYMS.some((group) => group.some((term) => words(term).join("") === compact));
  const list: Reading[] = [{ words: typed, weight: 1, phrase, fuzzy: !known }];
  if (typed.length > 1) list.push({ words: [compact], weight: JOINED_WEIGHT, phrase, fuzzy: !known });
  for (const group of SEARCH_SYNONYMS) {
    const forms = group.map((term) => words(term));
    // A concept is asked for when the query is it, or within one typo of it ("dim sun", "dimsum").
    const asked = forms.some((form) => {
      const joined = form.join("");
      return joined === compact || (joined.length >= 5 && editDistance(compact, joined, 1) <= 1);
    });
    if (!asked) continue;
    for (const form of forms) {
      const joined = form.join("");
      if (joined === compact) continue;
      // Run together, a two-word synonym only matches those words side by side ("milk tea", not "milk bread … teal").
      list.push({ words: [joined], weight: SYNONYM_WEIGHT, phrase: form.join(" "), fuzzy: false });
    }
  }
  return list;
}

/**
 * Places matching the query, best first. Fuzzy matching only kicks in for a
 * word nothing matches outright, so "wine" never drags in "wind".
 */
export function searchPlaces(index: readonly SearchDoc[], query: string): SearchHit[] {
  const options = readings(query);
  if (options.length === 0 || normalize(query).replace(/ /g, "").length < 2) return [];
  const hits = new Map<string, SearchHit>();
  for (const reading of options) {
    const fuzzy = reading.words.map((word) => reading.fuzzy && !index.some((doc) => matchWord(doc, word, false)));
    for (const doc of index) {
      let score = 0;
      let best: FieldKind = "about";
      let matchedAll = true;
      for (let i = 0; i < reading.words.length; i++) {
        const match = matchWord(doc, reading.words[i], fuzzy[i]);
        if (!match) {
          matchedAll = false;
          break;
        }
        score += match.score;
        if (RANK[match.kind] < RANK[best]) best = match.kind;
      }
      if (!matchedAll) continue;
      if (doc.name.startsWith(reading.phrase)) score += 6;
      else if (doc.name.includes(reading.phrase)) score += 3;
      score = (score / reading.words.length) * reading.weight;
      const previous = hits.get(doc.id);
      if (!previous || score > previous.score) {
        hits.set(doc.id, {
          id: doc.id,
          score,
          best: previous && RANK[previous.best] < RANK[best] ? previous.best : best,
        });
      } else if (RANK[best] < RANK[previous.best]) {
        previous.best = best;
      }
    }
  }
  return [...hits.values()].sort((a, b) => b.score - a.score || RANK[a.best] - RANK[b.best]);
}

/** How a hit ranks against the sort order: name matches, then what it is, then where, then the description. */
export function hitTier(hit: SearchHit): number {
  return RANK[hit.best];
}

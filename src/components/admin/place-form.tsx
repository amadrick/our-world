"use client";

import { AlertCircle, Feather, Link2, Loader, MapPin, Search, Star, X } from "react-feather";
import { useEffect, useRef, useState } from "react";

import { Pill } from "@/components/explorer/filter-bar";
import { CategoryBadge, CategoryIcon } from "@/components/places/category-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  lookupPlace,
  requestSummary,
  researchPlace,
  savePlace,
  type LookupResult,
  type PlaceCandidate,
} from "@/lib/admin/api";
import { foodIn, researchText } from "@/lib/images/food-guard.mjs";
import type { PlaceInputPayload } from "@/lib/places/schema";
import { ANDY_PICK, CATEGORIES, TAGS } from "@/lib/places/taxonomy";
import type { CategoryId, Place, PlaceResearch, SummarySource, TagId } from "@/lib/places/types";
import { LocationPreview } from "./location-preview";

interface Draft {
  name: string;
  category: CategoryId | null;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  tags: TagId[];
  andyFavorite: boolean;
  note: string;
  summary: string;
  summarySource: SummarySource;
  signatureSubject: string;
  signatureRationale?: string;
  research: ResearchDraft;
  appleMapsUrl?: string;
  googleMapsUrl?: string;
  image?: string;
  imageColor?: string;
}

/** Place research as edited in the form; iconic details are one per line. */
interface ResearchDraft {
  street: string;
  terrain: string;
  architecture: string;
  unique: string;
  iconic: string;
  view: "facade" | "interior";
  viewNote: string;
  sources: string[];
  unverified: string;
}

function researchDraft(research?: PlaceResearch): ResearchDraft {
  return {
    street: research?.street ?? "",
    terrain: research?.terrain ?? "",
    architecture: research?.architecture ?? "",
    unique: research?.unique ?? "",
    iconic: research?.iconic.join("\n") ?? "",
    view: research?.view ?? "facade",
    viewNote: research?.viewNote ?? "",
    sources: research?.sources ?? [],
    unverified: research?.unverified ?? "",
  };
}

function researchFromDraft(draft: ResearchDraft): PlaceResearch | undefined {
  const research: PlaceResearch = {
    street: draft.street.trim(),
    terrain: draft.terrain.trim(),
    architecture: draft.architecture.trim(),
    unique: draft.unique.trim(),
    iconic: draft.iconic
      .split("\n")
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean),
    view: draft.view,
    viewNote: draft.viewNote.trim() || undefined,
    sources: draft.sources,
    unverified: draft.unverified.trim() || undefined,
  };
  const empty = !research.street && !research.terrain && !research.architecture && !research.unique;
  return empty && research.iconic.length === 0 ? undefined : research;
}

/** Everything that goes into the image prompt, to tell when a saved place needs a new image. */
function imageInputs(place: Pick<Place, "name" | "neighborhood" | "address" | "placeResearch">) {
  const { sources: _sources, unverified: _unverified, ...research } = place.placeResearch ?? {};
  return JSON.stringify([place.name, place.neighborhood, place.address, research]);
}

type LookupState =
  | { status: "idle" }
  | { status: "loading"; isLink: boolean }
  | ({ status: "done" } & LookupResult)
  | { status: "error"; message: string };

function draftFromPlace(place: Place): Draft {
  return {
    name: place.name,
    category: place.category,
    neighborhood: place.neighborhood,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    tags: place.tags,
    andyFavorite: place.andyFavorite === true,
    note: place.note ?? "",
    summary: place.summary,
    summarySource: place.summarySource,
    signatureSubject: place.signatureSubject ?? "",
    signatureRationale: place.signatureRationale,
    research: researchDraft(place.placeResearch),
    appleMapsUrl: place.appleMapsUrl,
    googleMapsUrl: place.googleMapsUrl,
    image: place.image,
    imageColor: place.imageColor,
  };
}

function draftFromCandidate(candidate: PlaceCandidate, lookup?: LookupResult): Draft {
  return {
    name: candidate.name,
    category: candidate.category ?? null,
    neighborhood: candidate.neighborhood,
    address: candidate.address,
    lat: candidate.lat,
    lng: candidate.lng,
    tags: [],
    andyFavorite: false,
    note: "",
    summary: "",
    summarySource: "written",
    signatureSubject: "",
    research: researchDraft(),
    appleMapsUrl: lookup?.provider === "apple" ? lookup.url : undefined,
    googleMapsUrl: lookup?.provider === "google" ? lookup.url : undefined,
  };
}

function toPayload({ research, ...draft }: Draft, category: CategoryId): PlaceInputPayload {
  return { ...draft, category, placeResearch: researchFromDraft(research) };
}

const looksLikeLink = (value: string) => /https?:\/\//i.test(value);

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-lg font-medium">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="glass-fill flex gap-2.5 rounded-[20px] px-4 py-3 text-sm">
      <AlertCircle size={16} className="mt-px shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </p>
  );
}

function CandidateList({
  lookup,
  onChoose,
}: {
  lookup: LookupState;
  onChoose: (candidate: PlaceCandidate) => void;
}) {
  if (lookup.status === "idle") return null;

  if (lookup.status === "loading") {
    return (
      <div className="space-y-1" aria-live="polite">
        <p className="flex items-center gap-2 px-1 pb-1 text-sm text-muted-foreground">
          <Loader size={14} className="animate-spin" />
          {lookup.isLink ? "Reading the link…" : "Searching…"}
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3.5 p-3">
            <Skeleton className="size-11 rounded-[14px]" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (lookup.status === "error") return <Callout>{lookup.message}</Callout>;

  if (lookup.candidates.length === 0) {
    return (
      <Callout>
        No matches. Try adding the neighborhood (“Zuni Café Hayes Valley”), or paste a link from
        the Share button in Apple Maps or Google Maps.
      </Callout>
    );
  }

  return (
    <ul aria-label="Matching places">
      {lookup.candidates.map((candidate) => (
        <li key={candidate.key}>
          <button
            type="button"
            onClick={() => onChoose(candidate)}
            className="flex w-full cursor-pointer items-center gap-3.5 rounded-[20px] p-3 text-left transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
          >
            {candidate.category ? (
              <CategoryBadge category={candidate.category} />
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-secondary">
                <MapPin size={18} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium">{candidate.name}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {[candidate.kind, candidate.address, candidate.neighborhood]
                  .filter(Boolean)
                  .join(" · ") || `${candidate.lat.toFixed(4)}, ${candidate.lng.toFixed(4)}`}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-medium text-background">
              Choose
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The research that makes a place's image specific to it, added to the image prompt. */
function ImageNotes({
  research,
  researching,
  onChange,
}: {
  research: ResearchDraft;
  researching: boolean;
  onChange: (patch: Partial<ResearchDraft>) => void;
}) {
  const food = foodIn(researchText(researchFromDraft(research)));
  const placeholder = (text: string) => (researching ? "Looking it up…" : text);
  return (
    <div className="space-y-4">
      <Section
        title="Image notes"
        hint="What makes it recognizable. Research fills these in; they’re added to the image prompt so the picture is of this place."
      />
      <div className="space-y-2">
        <Label htmlFor="iconic">Most iconic details</Label>
        <Textarea
          id="iconic"
          value={research.iconic}
          onChange={(e) => onChange({ iconic: e.target.value })}
          placeholder={placeholder("One per line, 2–4: the green corner awning, the neon blade sign…")}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label id="view-label">Best view</Label>
        <div role="radiogroup" aria-labelledby="view-label" className="flex gap-2">
          {(["facade", "interior"] as const).map((view) => (
            <Pill
              key={view}
              role="radio"
              aria-checked={research.view === view}
              aria-pressed={undefined}
              active={research.view === view}
              onClick={() => onChange({ view })}
              className="h-9 px-3.5 text-sm"
            >
              {view === "facade" ? "Facade" : "Interior"}
            </Pill>
          ))}
        </div>
      </div>
      <details className="group space-y-4 rounded-[20px] glass-fill px-4 py-3 open:pb-4">
        <summary className="cursor-pointer text-sm font-medium select-none">
          Street, terrain, and architecture
        </summary>
        <div className="mt-4 space-y-4">
          {(
            [
              ["street", "Street", "Corner or mid-block, what’s next door, the cross street"],
              ["terrain", "Terrain and setting", "Hill or flat, fog, views, trees, light"],
              ["architecture", "Architecture", "Era, materials, color, windows, awning, signage"],
              ["unique", "One of a kind", "Anything physically unlike anywhere else"],
            ] as const
          ).map(([key, label, hint]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`research-${key}`}>{label}</Label>
              <Textarea
                id={`research-${key}`}
                value={research[key]}
                onChange={(e) => onChange({ [key]: e.target.value })}
                placeholder={placeholder(hint)}
                rows={key === "architecture" ? 3 : 2}
              />
            </div>
          ))}
          {research.sources.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Sources:{" "}
              {research.sources.map((url, i) => (
                <span key={url}>
                  {i > 0 && ", "}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-black/25 underline-offset-4 hover:text-foreground"
                  >
                    {hostname(url)}
                  </a>
                </span>
              ))}
            </p>
          )}
          {research.unverified && (
            <p className="text-sm text-muted-foreground">Not verified: {research.unverified}</p>
          )}
        </div>
      </details>
      {food && (
        <p className="flex gap-2 text-sm text-muted-foreground">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          Pictures show the place, not food. Take out “{food}”.
        </p>
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<SummarySource, string> = {
  ai: "AI-written",
  written: "Written by you",
  placeholder: "Placeholder",
};

interface PlaceFormProps {
  editing: Place | null;
  neighborhoods: string[];
  aiEnabled: boolean;
  imagesEnabled: boolean;
  /** `drawImage` is set when the saved place needs a new image drawn. */
  onSaved: (place: Place, isNew: boolean, drawImage: boolean) => void;
  onCancelEdit: () => void;
  onAuthError: () => void;
}

export function PlaceForm({
  editing,
  neighborhoods,
  aiEnabled,
  imagesEnabled,
  onSaved,
  onCancelEdit,
  onAuthError,
}: PlaceFormProps) {
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const [draft, setDraft] = useState<Draft | null>(editing ? draftFromPlace(editing) : null);
  const [summaryPending, setSummaryPending] = useState(false);
  const [summaryNotice, setSummaryNotice] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [signatureNotice, setSignatureNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  const handleError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 401) onAuthError();
    return err instanceof ApiError ? err.message : fallback;
  };

  const research = async (target: Draft) => {
    if (!target.name.trim()) return;
    setResearching(true);
    setSignatureNotice(null);
    try {
      const result = await researchPlace({
        name: target.name,
        category: target.category ?? undefined,
        neighborhood: target.neighborhood,
        address: target.address,
        lat: target.lat,
        lng: target.lng,
      });
      const { signatureSubject, signatureRationale, placeResearch } = result;
      setDraft((d) =>
        d
          ? {
              ...d,
              ...(signatureSubject && { signatureSubject, signatureRationale }),
              ...(placeResearch && { research: researchDraft(placeResearch) }),
            }
          : d,
      );
      setSignatureNotice(result.notice ?? null);
    } catch (err) {
      setSignatureNotice(handleError(err, "Couldn’t look it up. Try again."));
    } finally {
      setResearching(false);
    }
  };

  const choose = (candidate: PlaceCandidate, result?: LookupResult) => {
    const next = draftFromCandidate(candidate, result);
    setDraft(next);
    setError(null);
    setSummaryNotice(null);
    setSignatureNotice(null);
    if (aiEnabled) void research(next);
  };

  const runLookup = (input: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isLink = looksLikeLink(input);
    setLookup({ status: "loading", isLink });
    lookupPlace(input, controller.signal)
      .then((result) => {
        setLookup({ status: "done", ...result });
        // A link that pins one exact place skips straight to the details.
        if (result.kind === "link" && result.candidates.length === 1) {
          choose(result.candidates[0], result);
        }
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setLookup({ status: "error", message: handleError(err, "Search failed. Try again.") });
      });
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    window.clearTimeout(timerRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      abortRef.current?.abort();
      setLookup({ status: "idle" });
      return;
    }
    timerRef.current = window.setTimeout(() => runLookup(trimmed), looksLikeLink(trimmed) ? 0 : 450);
  };

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateResearch = (patch: Partial<ResearchDraft>) =>
    setDraft((d) => (d ? { ...d, research: { ...d.research, ...patch } } : d));

  const toggleTag = (tag: TagId) =>
    setDraft((d) =>
      d
        ? { ...d, tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag] }
        : d,
    );

  const generateSummary = async () => {
    if (!draft?.category || !draft.name.trim()) return;
    setSummaryPending(true);
    setSummaryNotice(null);
    try {
      const result = await requestSummary(toPayload(draft, draft.category));
      update({ summary: result.summary, summarySource: result.source });
      setSummaryNotice(result.notice ?? null);
    } catch (err) {
      setSummaryNotice(handleError(err, "Couldn’t write a summary. Try again."));
    } finally {
      setSummaryPending(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) return setError("Give the place a name.");
    if (!draft.category) return setError("Pick a category so guests can filter for it.");
    setSaving(true);
    setError(null);
    try {
      const place = await savePlace(toPayload(draft, draft.category), editing?.id);
      const needsImage = !place.image || !editing || imageInputs(editing) !== imageInputs(place);
      onSaved(place, !editing, imagesEnabled && needsImage);
    } catch (err) {
      setError(handleError(err, "Couldn’t save. Try again."));
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="space-y-4">
        <Section
          title="Find the place"
          hint="Search by name, or paste a link from the Share button in Apple Maps or Google Maps."
        />
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-muted-foreground">
            {looksLikeLink(query) ? <Link2 size={18} /> : <Search size={18} />}
          </span>
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Tartine Bakery, or a Maps link"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label="Search for a place or paste a Maps link"
            className="h-14 rounded-full pr-12 pl-12"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear"
              className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <CandidateList
          lookup={lookup}
          onChoose={(c) => choose(c, lookup.status === "done" ? lookup : undefined)}
        />
      </div>
    );
  }

  const canWrite = Boolean(draft.category && draft.name.trim());

  return (
    <form onSubmit={save} className="space-y-10">
      <div className="space-y-4">
        <Section title={editing ? "Place" : "Found it"} />
        <div className="overflow-hidden rounded-[24px] hairline border-black/10 bg-white/40 dark:border-white/12 dark:bg-white/6">
          <LocationPreview lat={draft.lat} lng={draft.lng} className="h-44 sm:h-52" />
          <div className="flex items-center gap-3 border-t-[0.5px] border-black/10 py-2 pr-2 pl-4 dark:border-white/12">
            <MapPin size={16} className="shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {draft.address || `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`}
            </p>
            {!editing && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
                Change
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Section title="Details" />
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label id="category-label">Category</Label>
          <div role="radiogroup" aria-labelledby="category-label" className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const selected = draft.category === c.id;
              return (
                <Pill
                  key={c.id}
                  role="radio"
                  aria-checked={selected}
                  aria-pressed={undefined}
                  active={selected}
                  onClick={() => update({ category: c.id })}
                >
                  <CategoryIcon category={c.id} size={16} />
                  {c.label}
                </Pill>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signature">Known for</Label>
          <div className="flex gap-2">
            <Input
              id="signature"
              value={draft.signatureSubject}
              onChange={(e) =>
                update({ signatureSubject: e.target.value, signatureRationale: undefined })
              }
              placeholder={researching ? "Looking it up…" : "Morning bun, a martini, the courtyard"}
              className="min-w-0 flex-1"
            />
            {aiEnabled && (
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0"
                onClick={() => research(draft)}
                disabled={researching || !draft.name.trim()}
              >
                {researching ? <Loader size={15} className="animate-spin" /> : <Search size={15} />}
                Look it up
              </Button>
            )}
          </div>
          {draft.signatureRationale && (
            <p className="text-sm text-pretty">{draft.signatureRationale}</p>
          )}
          <p className="flex gap-2 text-sm text-muted-foreground">
            {signatureNotice && <AlertCircle size={14} className="mt-0.5 shrink-0" />}
            {signatureNotice ?? "The dish, drink, or room it’s famous for."}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="neighborhood">Neighborhood</Label>
            <Input
              id="neighborhood"
              list="neighborhood-options"
              value={draft.neighborhood}
              onChange={(e) => update({ neighborhood: e.target.value })}
              placeholder="Mission"
            />
            <datalist id="neighborhood-options">
              {neighborhoods.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={draft.address}
              onChange={(e) => update({ address: e.target.value })}
              placeholder="Street address"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label id="tags-label">Tags</Label>
          <div role="group" aria-labelledby="tags-label" className="flex flex-wrap gap-2">
            <Pill
              active={draft.andyFavorite}
              onClick={() => update({ andyFavorite: !draft.andyFavorite })}
            >
              <Star size={15} fill="currentColor" />
              {ANDY_PICK}
            </Pill>
            {TAGS.map((tag) => (
              <Pill key={tag.id} active={draft.tags.includes(tag.id)} onClick={() => toggleTag(tag.id)}>
                {tag.badge}
              </Pill>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">
            Your note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="note"
            value={draft.note}
            onChange={(e) => update({ note: e.target.value })}
            placeholder="What to order, when to go, or why you love it"
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-4">
        <Section
          title="Summary"
          hint={
            aiEnabled
              ? "A couple of sentences guests see under your note."
              : "AI summaries are off until an OpenAI key is added. Write your own or keep the placeholder."
          }
        />
        <div className="space-y-2">
          <Label htmlFor="summary">About this place</Label>
          <Textarea
            id="summary"
            value={draft.summary}
            onChange={(e) => update({ summary: e.target.value, summarySource: "written" })}
            placeholder={
              canWrite
                ? "Leave blank and one is written when you save."
                : "Pick a category first, then let AI write this or type your own."
            }
            rows={4}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {draft.summary && SOURCE_LABEL[draft.summarySource]}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateSummary}
              disabled={!canWrite || summaryPending}
            >
              {summaryPending ? <Loader size={15} className="animate-spin" /> : <Feather size={15} />}
              {summaryPending ? "Writing…" : draft.summary ? "Rewrite" : "Write it for me"}
            </Button>
          </div>
          {summaryNotice && (
            <p className="flex gap-2 text-sm text-muted-foreground">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {summaryNotice}
            </p>
          )}
        </div>
      </div>

      <ImageNotes
        research={draft.research}
        researching={researching}
        onChange={updateResearch}
      />

      <div className="sticky bottom-0 -mx-5 space-y-3 border-t-[0.5px] border-black/10 bg-white/70 px-5 dark:border-white/12 dark:bg-black/50 pt-4 pb-[max(env(safe-area-inset-bottom),16px)] backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {error && <Callout>{error}</Callout>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={editing ? onCancelEdit : () => setDraft(null)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={saving}>
            {saving && <Loader size={16} className="animate-spin" />}
            {saving
              ? !draft.summary
                ? "Writing summary and saving…"
                : "Saving…"
              : editing
                ? "Save changes"
                : "Add to the map"}
          </Button>
        </div>
      </div>
    </form>
  );
}
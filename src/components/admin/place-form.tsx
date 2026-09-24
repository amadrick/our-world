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
  savePlace,
  type LookupResult,
  type PlaceCandidate,
} from "@/lib/admin/api";
import type { PlaceInputPayload } from "@/lib/places/schema";
import { CATEGORIES, TAGS } from "@/lib/places/taxonomy";
import type { CategoryId, Place, SummarySource, TagId } from "@/lib/places/types";
import { LocationPreview } from "./location-preview";

interface Draft {
  name: string;
  category: CategoryId | null;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  tags: TagId[];
  note: string;
  summary: string;
  summarySource: SummarySource;
  appleMapsUrl?: string;
  googleMapsUrl?: string;
  image?: string;
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
    note: place.note ?? "",
    summary: place.summary,
    summarySource: place.summarySource,
    appleMapsUrl: place.appleMapsUrl,
    googleMapsUrl: place.googleMapsUrl,
    image: place.image,
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
    note: "",
    summary: "",
    summarySource: "written",
    appleMapsUrl: lookup?.provider === "apple" ? lookup.url : undefined,
    googleMapsUrl: lookup?.provider === "google" ? lookup.url : undefined,
  };
}

function toPayload(draft: Draft, category: CategoryId): PlaceInputPayload {
  return { ...draft, category };
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
            className="flex w-full cursor-pointer items-center gap-3.5 rounded-[20px] p-3 text-left transition-colors hover:bg-white/50 focus-visible:bg-white/50 focus-visible:outline-none"
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
            <span className="shrink-0 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-medium text-white">
              Choose
            </span>
          </button>
        </li>
      ))}
    </ul>
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
  onSaved: (place: Place, isNew: boolean) => void;
  onCancelEdit: () => void;
  onAuthError: () => void;
}

export function PlaceForm({
  editing,
  neighborhoods,
  aiEnabled,
  onSaved,
  onCancelEdit,
  onAuthError,
}: PlaceFormProps) {
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const [draft, setDraft] = useState<Draft | null>(editing ? draftFromPlace(editing) : null);
  const [summaryPending, setSummaryPending] = useState(false);
  const [summaryNotice, setSummaryNotice] = useState<string | null>(null);
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

  const choose = (candidate: PlaceCandidate, result?: LookupResult) => {
    setDraft(draftFromCandidate(candidate, result));
    setError(null);
    setSummaryNotice(null);
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
      onSaved(place, !editing);
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
        <div className="overflow-hidden rounded-[24px] hairline border-black/10 bg-white/40">
          <LocationPreview lat={draft.lat} lng={draft.lng} className="h-44 sm:h-52" />
          <div className="flex items-center gap-3 border-t-[0.5px] border-black/10 py-2 pr-2 pl-4">
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
            {TAGS.map((tag) => (
              <Pill key={tag.id} active={draft.tags.includes(tag.id)} onClick={() => toggleTag(tag.id)}>
                {tag.id === "top-pick" && <Star size={15} fill="currentColor" />}
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

      <div className="sticky bottom-0 -mx-5 space-y-3 border-t-[0.5px] border-black/10 bg-white/70 px-5 pt-4 pb-[max(env(safe-area-inset-bottom),16px)] backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
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
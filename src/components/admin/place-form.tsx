"use client";

import {
  CircleAlert,
  Link2,
  LoaderCircle,
  MapPin,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CategoryBadge } from "@/components/places/category-badge";
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
import { CATEGORIES, TAGS, getCategory } from "@/lib/places/taxonomy";
import type { CategoryId, Place, SummarySource, TagId } from "@/lib/places/types";
import { cn } from "@/lib/utils";
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

function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="flex size-6 shrink-0 translate-y-[-1px] items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-white">
        {n}
      </span>
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
        {hint && <p className="mt-0.5 text-[14px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
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
      <div className="space-y-1 pt-2" aria-live="polite">
        <p className="flex items-center gap-2 px-1 pb-1 text-[13px] text-muted-foreground">
          <LoaderCircle className="size-3.5 animate-spin" />
          {lookup.isLink ? "Reading the link…" : "Searching…"}
        </p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 rounded-2xl p-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (lookup.status === "error") {
    return (
      <p
        role="alert"
        className="mt-3 flex gap-2.5 rounded-2xl bg-note px-4 py-3 text-[14px] leading-relaxed text-note-foreground"
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        {lookup.message}
      </p>
    );
  }

  if (lookup.candidates.length === 0) {
    return (
      <p className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-[14px] leading-relaxed text-muted-foreground">
        No matches. Try adding the neighborhood (“Zuni Café Hayes Valley”), or paste a link from
        the Share button in Apple Maps or Google Maps.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5 pt-2" aria-label="Matching places">
      {lookup.candidates.map((candidate) => (
        <li key={candidate.key}>
          <button
            type="button"
            onClick={() => onChoose(candidate)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
          >
            {candidate.category ? (
              <CategoryBadge category={candidate.category} />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                <MapPin className="size-[18px] text-muted-foreground" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{candidate.name}</span>
              <span className="block truncate text-[13px] text-muted-foreground">
                {[candidate.kind, candidate.address, candidate.neighborhood]
                  .filter(Boolean)
                  .join(" · ") || `${candidate.lat.toFixed(4)}, ${candidate.lng.toFixed(4)}`}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-[13px] font-semibold text-white">
              Choose
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SummaryBadge({ source }: { source: SummarySource }) {
  const styles: Record<SummarySource, [string, string]> = {
    ai: ["AI-written", "bg-violet-50 text-violet-700 ring-violet-200"],
    written: ["Written by you", "bg-secondary text-muted-foreground ring-black/5"],
    placeholder: ["Placeholder", "bg-amber-50 text-amber-800 ring-amber-200"],
  };
  const [label, className] = styles[source];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", className)}>
      {label}
    </span>
  );
}

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
      setSummaryNotice(handleError(err, "Couldn't write a summary. Try again."));
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
      setError(handleError(err, "Couldn't save. Try again."));
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="space-y-4">
        <Step
          n={1}
          title="Find the place"
          hint="Search by name, or paste a link from the Share button in Apple Maps or Google Maps."
        />
        <div className="relative">
          {looksLikeLink(query) ? (
            <Link2 className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          ) : (
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="e.g. Tartine Bakery, or https://maps.apple.com/…"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label="Search for a place or paste a Maps link"
            className="h-14 rounded-2xl border-black/10 bg-white pr-12 pl-12 text-[17px] shadow-[0_1px_2px_rgb(0_0_0/0.04)] md:text-[17px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear"
              className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <CandidateList lookup={lookup} onChoose={(c) => choose(c, lookup.status === "done" ? lookup : undefined)} />
      </div>
    );
  }

  const category = draft.category ? getCategory(draft.category) : null;
  const canWrite = Boolean(draft.category && draft.name.trim());

  return (
    <form onSubmit={save} className="space-y-9">
      <div className="space-y-4">
        <Step n={1} title={editing ? "Place" : "Found it"} />
        <div className="overflow-hidden rounded-2xl border border-black/[0.08]">
          <LocationPreview
            lat={draft.lat}
            lng={draft.lng}
            color={category?.color ?? "#1d1d1f"}
            className="h-44 sm:h-52"
          />
          <div className="flex items-center gap-3 px-4 py-3">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate text-[14px] text-muted-foreground">
              {draft.address || `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`}
            </p>
            {!editing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-full"
                onClick={() => setDraft(null)}
              >
                Change
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <Step n={2} title="Details" />
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-12 rounded-xl text-[16px]"
            required
          />
        </div>

        <div className="space-y-2">
          <Label id="category-label">Category</Label>
          <div role="radiogroup" aria-labelledby="category-label" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {CATEGORIES.map((c) => {
              const selected = draft.category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update({ category: c.id })}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 rounded-2xl px-2 py-3.5 text-[13px] font-semibold transition-all",
                    selected ? "bg-white" : "bg-secondary/70 text-foreground/80 hover:bg-secondary",
                  )}
                  style={
                    selected
                      ? { boxShadow: `inset 0 0 0 2px ${c.color}`, backgroundColor: `${c.color}0f`, color: c.color }
                      : undefined
                  }
                >
                  <CategoryBadge category={c.id} className={cn(!selected && "opacity-90")} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="neighborhood">Neighborhood</Label>
            <Input
              id="neighborhood"
              list="neighborhood-options"
              value={draft.neighborhood}
              onChange={(e) => update({ neighborhood: e.target.value })}
              placeholder="e.g. Mission"
              className="h-12 rounded-xl text-[16px]"
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
              className="h-12 rounded-xl text-[16px]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label id="tags-label">Tags</Label>
          <div role="group" aria-labelledby="tags-label" className="flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const active = draft.tags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors",
                    active ? "bg-foreground text-white" : "bg-secondary text-foreground hover:bg-black/[0.07]",
                  )}
                >
                  {tag.id === "andys-pick" && <Star className="size-4 fill-amber-400 text-amber-400" />}
                  {tag.badge}
                </button>
              );
            })}
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
            className="rounded-xl text-[16px] md:text-[15px]"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Step
          n={3}
          title="Summary"
          hint={
            aiEnabled
              ? "A couple of sentences guests see under your note."
              : "AI summaries are off until an OpenAI key is added. Write your own or keep the placeholder."
          }
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="summary">About this place</Label>
              {draft.summary && <SummaryBadge source={draft.summarySource} />}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={generateSummary}
              disabled={!canWrite || summaryPending}
              className="h-9 rounded-full border-black/10 px-3.5 text-[13px] font-semibold"
            >
              {summaryPending ? <LoaderCircle className="animate-spin" /> : <Sparkles className="text-violet-600" />}
              {summaryPending ? "Writing…" : draft.summary ? "Rewrite" : "Write it for me"}
            </Button>
          </div>
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
            className="rounded-xl text-[16px] leading-relaxed md:text-[15px]"
          />
          {summaryNotice && (
            <p className="flex gap-2 text-[13px] leading-relaxed text-note-foreground">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              {summaryNotice}
            </p>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 space-y-3 border-t border-black/[0.06] bg-white/95 px-5 pt-4 pb-[max(env(safe-area-inset-bottom),16px)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {error && (
          <p role="alert" className="flex gap-2 text-[14px] text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="h-12 rounded-xl px-5 text-[15px]"
            onClick={editing ? onCancelEdit : () => setDraft(null)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="h-12 rounded-xl px-6 text-[15px] font-semibold">
            {saving && <LoaderCircle className="animate-spin" />}
            {saving
              ? !draft.summary
                ? "Writing summary & saving…"
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

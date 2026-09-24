"use client";

import { ArrowUpRight, Edit2, Star, Trash2 } from "react-feather";
import { useState } from "react";

import { PlaceImage } from "@/components/places/place-image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getCategory } from "@/lib/places/taxonomy";
import type { Place } from "@/lib/places/types";
import { smartQuotes } from "@/lib/typography";

interface AdminPlacesListProps {
  places: Place[];
  onEdit: (place: Place) => void;
  onDelete: (place: Place) => Promise<void>;
}

export function AdminPlacesList({ places, onEdit, onDelete }: AdminPlacesListProps) {
  const [confirming, setConfirming] = useState<Place | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <section aria-labelledby="places-heading">
      <div className="flex items-baseline justify-between px-1">
        <h2 id="places-heading" className="text-lg font-medium">
          On the map
        </h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {places.length} {places.length === 1 ? "place" : "places"}
        </span>
      </div>

      {places.length === 0 ? (
        <p className="glass glass-thick mt-3 rounded-[28px] px-6 py-10 text-center text-base text-muted-foreground">
          Nothing here yet. Places you add show up here and on the guide right away.
        </p>
      ) : (
        <ul className="glass glass-thick mt-3 divide-y-[0.5px] divide-black/10 overflow-hidden rounded-[28px]">
          {places.map((place) => (
            <li key={place.id} className="flex items-center gap-3.5 py-3 pr-2 pl-4">
              <PlaceImage
                place={place}
                sizes="64px"
                className="w-16 shrink-0 rounded-[12px]"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-base font-medium">
                  <span className="truncate">{smartQuotes(place.name)}</span>
                  {place.tags.includes("top-pick") && (
                    <Star size={12} fill="currentColor" className="shrink-0" aria-label="Top pick" />
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {getCategory(place.category).label}
                  {place.neighborhood && ` · ${place.neighborhood}`}
                  {place.summarySource === "placeholder" && " · Placeholder summary"}
                  {!place.image && " · No image yet"}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <Button variant="ghost" size="icon-sm" asChild>
                  <a
                    href={`/?place=${place.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${place.name} in the guide`}
                  >
                    <ArrowUpRight size={16} />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(place)}
                  aria-label={`Edit ${place.name}`}
                >
                  <Edit2 size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setConfirming(place)}
                  aria-label={`Remove ${place.name}`}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirming ? smartQuotes(confirming.name) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the guide for everyone. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (event) => {
                event.preventDefault();
                if (!confirming) return;
                setDeleting(true);
                await onDelete(confirming);
                setDeleting(false);
                setConfirming(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

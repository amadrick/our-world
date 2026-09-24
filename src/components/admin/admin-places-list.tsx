"use client";

import { ArrowUpRight, Pencil, Star, Trash2 } from "lucide-react";
import { useState } from "react";

import { CategoryBadge } from "@/components/places/category-badge";
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
        <h2 id="places-heading" className="text-[17px] font-semibold">
          On the map
        </h2>
        <span className="text-[14px] text-muted-foreground tabular-nums">
          {places.length} {places.length === 1 ? "place" : "places"}
        </span>
      </div>

      {places.length === 0 ? (
        <p className="mt-3 rounded-[24px] border border-dashed border-black/15 px-6 py-10 text-center text-[15px] text-muted-foreground">
          Nothing here yet. Places you add show up here and on the guide right away.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-black/[0.06] overflow-hidden rounded-[24px] border border-black/[0.07] bg-white">
          {places.map((place) => (
            <li key={place.id} className="flex items-center gap-3 px-4 py-3">
              <CategoryBadge category={place.category} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                  <span className="truncate">{place.name}</span>
                  {place.tags.includes("andys-pick") && (
                    <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Andy's pick" />
                  )}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {getCategory(place.category).label}
                  {place.neighborhood && ` · ${place.neighborhood}`}
                  {place.summarySource === "placeholder" && (
                    <span className="text-amber-700"> · Placeholder summary</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button variant="ghost" size="icon" className="size-9 rounded-full" asChild>
                  <a href={`/?place=${place.id}`} target="_blank" rel="noreferrer" aria-label={`View ${place.name} in the guide`}>
                    <ArrowUpRight />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-full"
                  onClick={() => onEdit(place)}
                  aria-label={`Edit ${place.name}`}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-full text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirming(place)}
                  aria-label={`Remove ${place.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent className="rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirming?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the guide for everyone. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
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

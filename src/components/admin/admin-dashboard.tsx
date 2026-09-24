"use client";

import { AlertTriangle, ArrowUpRight, Feather, LogOut, type Icon } from "react-feather";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { ApiError, deletePlace, generatePlaceImage, signOut, type ImageHint } from "@/lib/admin/api";
import type { Place } from "@/lib/places/types";
import { AdminPlacesList } from "./admin-places-list";
import { ImageBackdrop } from "./image-backdrop";
import { PlaceForm } from "./place-form";

interface AdminDashboardProps {
  initialPlaces: Place[];
  backdrop: string[];
  ai: { enabled: boolean; model: string };
  /** Whether saving a place also draws its illustration. */
  imagesEnabled: boolean;
  usingDefaultPassword: boolean;
}

function Notice({ icon: NoticeIcon, children }: { icon: Icon; children: React.ReactNode }) {
  return (
    <div className="glass-fill flex gap-3 rounded-[20px] px-4 py-3 text-sm">
      <NoticeIcon size={16} className="mt-px shrink-0 text-muted-foreground" />
      <div>{children}</div>
    </div>
  );
}

function newestFirst(places: Place[]): Place[] {
  return [...places].sort(
    (a, b) =>
      (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt) ||
      a.name.localeCompare(b.name),
  );
}

export function AdminDashboard({
  initialPlaces,
  backdrop,
  ai,
  imagesEnabled,
  usingDefaultPassword,
}: AdminDashboardProps) {
  const router = useRouter();
  const [places, setPlaces] = useState(initialPlaces);
  const [editing, setEditing] = useState<Place | null>(null);
  const [formKey, setFormKey] = useState(0);

  const sorted = useMemo(() => newestFirst(places), [places]);
  const neighborhoods = useMemo(
    () => [...new Set(places.map((p) => p.neighborhood).filter(Boolean))].sort(),
    [places],
  );

  const resetForm = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
  };

  const onAuthError = () => {
    toast.error("Your session ended. Sign in again.");
    router.refresh();
  };

  const onSaved = (place: Place, isNew: boolean, illustrate?: ImageHint) => {
    setPlaces((prev) =>
      isNew ? [...prev, place] : prev.map((p) => (p.id === place.id ? place : p)),
    );
    resetForm();
    toast.success(isNew ? `${place.name} is on the map` : `Saved ${place.name}`, {
      action: {
        label: "View",
        onClick: () => window.open(`/?place=${place.id}`, "_blank"),
      },
    });
    if (!illustrate) return;
    toast.promise(
      generatePlaceImage(place.id, illustrate).then((drawn) => {
        setPlaces((prev) => prev.map((p) => (p.id === drawn.id ? drawn : p)));
        return drawn;
      }),
      {
        loading: `Drawing ${place.name}’s illustration…`,
        success: `Illustration added for ${place.name}`,
        error: (err) =>
          err instanceof ApiError ? err.message : "Couldn’t draw the illustration. Try again later.",
      },
    );
  };

  const onEdit = (place: Place) => {
    setEditing(place);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (place: Place) => {
    try {
      await deletePlace(place.id);
      setPlaces((prev) => prev.filter((p) => p.id !== place.id));
      if (editing?.id === place.id) resetForm();
      toast.success(`Removed ${place.name}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onAuthError();
      toast.error(err instanceof ApiError ? err.message : "Couldn’t remove it. Try again.");
    }
  };

  return (
    <div className="relative isolate min-h-dvh">
      <ImageBackdrop images={backdrop} />
      <header className="glass sticky top-0 z-30 rounded-none border-x-0 border-t-0 shadow-[inset_0_-0.5px_0_rgb(0_0_0/0.08)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <p className="text-base">
            <span className="font-medium">{site.name}</span>
            <span className="text-muted-foreground"> Admin</span>
          </p>
          <div className="flex items-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" target="_blank">
                View guide
                <ArrowUpRight size={15} />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut().catch(() => undefined);
                router.refresh();
              }}
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 pt-8 pb-16">
        {(usingDefaultPassword || !ai.enabled) && (
          <div className="space-y-2">
            {!ai.enabled && (
              <Notice icon={Feather}>
                AI summaries are off. Add OPENAI_API_KEY to .env.local and restart the server.
                Until then, new places get a placeholder you can edit.
              </Notice>
            )}
            {usingDefaultPassword && (
              <Notice icon={AlertTriangle}>
                You’re using the built-in local password. Set ADMIN_PASSWORD in .env.local before
                sharing this site.
              </Notice>
            )}
          </div>
        )}

        <section className="glass glass-thick rounded-[32px] p-5 sm:p-8">
          <div className="mb-8">
            <h1 className="text-xl font-medium">
              {editing ? `Edit ${editing.name}` : "Add a place"}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {editing
                ? "Changes show up in the guide as soon as you save."
                : "Guests see it on the map the moment you save."}
              {ai.enabled && !editing && ` Summaries are written by ${ai.model}.`}
            </p>
          </div>
          <PlaceForm
            key={formKey}
            editing={editing}
            neighborhoods={neighborhoods}
            aiEnabled={ai.enabled}
            imagesEnabled={imagesEnabled}
            onSaved={onSaved}
            onCancelEdit={resetForm}
            onAuthError={onAuthError}
          />
        </section>

        <AdminPlacesList places={sorted} onEdit={onEdit} onDelete={onDelete} />
      </main>
    </div>
  );
}

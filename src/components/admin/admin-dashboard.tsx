"use client";

import { AlertTriangle, ArrowUpRight, Feather, LogOut, type Icon } from "react-feather";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { site } from "@/config/site";
import { ApiError, deletePlace, signOut } from "@/lib/admin/api";
import type { Place } from "@/lib/places/types";
import { AdminPlacesList } from "./admin-places-list";
import { PlaceForm } from "./place-form";

interface AdminDashboardProps {
  initialPlaces: Place[];
  ai: { enabled: boolean; model: string };
  usingDefaultPassword: boolean;
}

function Notice({ icon: NoticeIcon, children }: { icon: Icon; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-[20px] bg-secondary px-4 py-3 text-sm">
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

export function AdminDashboard({ initialPlaces, ai, usingDefaultPassword }: AdminDashboardProps) {
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

  const onSaved = (place: Place, isNew: boolean) => {
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
    <div className="min-h-dvh bg-map">
      <header className="sticky top-0 z-30 border-b-[0.5px] border-black/10 bg-white/90 backdrop-blur-xl">
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

        <section className="rounded-[32px] hairline border-black/10 bg-white p-5 shadow-panel sm:p-8">
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

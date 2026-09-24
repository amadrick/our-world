"use client";

import { ArrowUpRight, LogOut, Sparkles, TriangleAlert } from "lucide-react";
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

function Notice({ icon: Icon, children }: { icon: typeof Sparkles; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-note-border bg-note px-4 py-3 text-[14px] leading-relaxed text-note-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" />
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
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove it. Try again.");
    }
  };

  return (
    <div className="min-h-dvh bg-[#F7F6F3]">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-[22px] leading-none">{site.name}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="h-9 rounded-full px-3 text-[14px]" asChild>
              <Link href="/" target="_blank">
                View guide
                <ArrowUpRight />
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="h-9 rounded-full px-3 text-[14px]"
              onClick={async () => {
                await signOut().catch(() => undefined);
                router.refresh();
              }}
            >
              <LogOut />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 pt-8 pb-16">
        {(usingDefaultPassword || !ai.enabled) && (
          <div className="space-y-2">
            {!ai.enabled && (
              <Notice icon={Sparkles}>
                AI summaries are off. Add <code className="font-mono">OPENAI_API_KEY</code> to{" "}
                <code className="font-mono">.env.local</code> and restart the server. Until then, new
                places get a placeholder you can edit.
              </Notice>
            )}
            {usingDefaultPassword && (
              <Notice icon={TriangleAlert}>
                You&apos;re using the built-in local password. Set{" "}
                <code className="font-mono">ADMIN_PASSWORD</code> in{" "}
                <code className="font-mono">.env.local</code> before sharing this site.
              </Notice>
            )}
          </div>
        )}

        <section className="rounded-[28px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-16px_rgb(0_0_0/0.12)] sm:p-8">
          <div className="mb-7">
            <h1 className="font-serif text-[36px] leading-none tracking-[-0.01em]">
              {editing ? `Edit ${editing.name}` : "Add a place"}
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              {editing
                ? "Changes show up in the guide as soon as you save."
                : "Guests see it on the map the moment you save."}
              {ai.enabled && !editing && (
                <span className="text-muted-foreground/80"> Summaries are written by {ai.model}.</span>
              )}
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

"use client";

import { useSyncExternalStore } from "react";

import { SAVED_KEY, knownSaved, readSaved, toggleSavedId, writeSaved } from "@/lib/places/saved";

const EVENT = "sf-recs:saved";
const NONE: ReadonlySet<string> = new Set();

let current: { ids: string[]; set: ReadonlySet<string> } | null = null;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function snapshot() {
  if (!current) {
    const ids = readSaved(storage());
    current = { ids, set: new Set(ids) };
  }
  return current;
}

function commit(ids: string[]) {
  current = { ids, set: new Set(ids) };
  // Private mode or storage disabled: the list still works until the page reloads.
  writeSaved(storage(), ids);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    // Another tab saved or unsaved something (or cleared storage, with a null key).
    if (event.key !== SAVED_KEY && event.key !== null) return;
    current = null;
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Every saved id on this device. The server, and the first paint, see none. */
export function useSavedIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => snapshot().set, () => NONE);
}

export function useIsSaved(id: string): boolean {
  return useSyncExternalStore(subscribe, () => snapshot().set.has(id), () => false);
}

export function toggleSaved(id: string) {
  commit(toggleSavedId(snapshot().ids, id));
}

/** Forgets saves for places no longer in the guide. */
export function pruneSaved(known: ReadonlySet<string>) {
  const { ids } = snapshot();
  const kept = knownSaved(ids, known);
  if (kept.length !== ids.length) commit(kept);
}

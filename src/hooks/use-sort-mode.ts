"use client";

import { useCallback, useSyncExternalStore } from "react";

import { SORT_MODES, type SortMode } from "@/lib/places/smart-order";

const KEY = "sf-recs:sort";
const EVENT = "sf-recs:sort";
const DEFAULT: SortMode = "near";

// Holds the choice when storage is unavailable, so the switch still works.
let current: SortMode | null = null;

function read(): SortMode {
  if (current) return current;
  try {
    // Anything else saved (the old "smart" and "nearest") is Near you now.
    const saved = window.sessionStorage.getItem(KEY);
    return (SORT_MODES as readonly string[]).includes(saved ?? "") ? (saved as SortMode) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** The list's order (Near you or A–Z), remembered for the session. */
export function useSortMode(): [SortMode, (mode: SortMode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const setMode = useCallback((next: SortMode) => {
    current = next;
    try {
      window.sessionStorage.setItem(KEY, next);
    } catch {
      // Storage disabled: the choice lasts until reload.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [mode, setMode];
}

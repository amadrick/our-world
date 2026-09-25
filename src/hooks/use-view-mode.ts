"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { ViewMode } from "@/components/explorer/mode-switch";

const KEY = "sf-recs:view";
const EVENT = "sf-recs:view";
const DEFAULT: ViewMode = "map";

// Holds the choice when storage is unavailable, so the switch still works.
let current: ViewMode | null = null;

function read(): ViewMode {
  if (current) return current;
  try {
    const saved = window.localStorage.getItem(KEY);
    return saved === "list" || saved === "map" ? saved : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
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

/** The guide's List/Map mode, remembered across refreshes. Server renders the map. */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const setMode = useCallback((next: ViewMode) => {
    current = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Private mode or storage disabled: the choice lasts until reload.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [mode, setMode];
}

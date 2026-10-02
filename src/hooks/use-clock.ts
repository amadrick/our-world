"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { localClock } from "@/lib/places/hours";

interface Clocks {
  /** For "Open now · closes 10 PM": kept to the minute. */
  now: Date;
  /** What the Near you order sorts by: moves on the hour or when the page comes back. */
  orderNow: Date;
}

const TICK_MS = 60 * 1000;
const hourOf = (date: Date) => {
  const { day, minutes } = localClock(date);
  return day * 24 + Math.floor(minutes / 60);
};

function createClockStore(renderedAt: Date) {
  let clocks: Clocks = { now: renderedAt, orderNow: renderedAt };
  let hold = () => false;
  const set = (next: Clocks) => {
    clocks = next;
  };
  return {
    setHold(next: () => boolean) {
      hold = next;
    },
    getSnapshot: () => clocks,
    subscribe(onChange: () => void) {
      const refresh = (reorder: boolean) => {
        const now = new Date();
        set({ now, orderNow: reorder ? now : clocks.orderNow });
        onChange();
      };
      // Coming back to the page is a fresh look: re-sort right away. The first
      // subscription is that moment too, after hydration used the server's time.
      refresh(true);
      const timer = window.setInterval(() => {
        const now = new Date();
        // A new hour re-sorts, but not while the reader is scrolled into the list or has a place open.
        refresh(hourOf(now) !== hourOf(clocks.orderNow) && !hold());
      }, TICK_MS);
      const onVisible = () => {
        if (document.visibilityState === "visible") refresh(true);
      };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", onVisible);
      return () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", onVisible);
      };
    },
  };
}

/**
 * The time in San Francisco for hours and the Near you order. Server render and
 * hydration use `renderedAt`, so both agree; then the browser's clock takes over.
 */
export function useClocks(renderedAt: string, hold: () => boolean): Clocks {
  const [store] = useState(() => createClockStore(new Date(renderedAt)));
  useEffect(() => store.setHold(hold));
  const [serverClocks] = useState<Clocks>(() => ({ now: new Date(renderedAt), orderNow: new Date(renderedAt) }));
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => serverClocks);
}

"use client";

import { useEffect, useRef, useState } from "react";

import { metersBetween, snapOrigin, type Origin } from "@/lib/geo/drive-times";

/** Moving less than this doesn't change a drive time enough to ask again. */
export const REFETCH_METERS = 300;
/** After a failed request, positions keep arriving; wait this long before asking again. */
const RETRY_MS = 30000;

interface DriveTimesState {
  seconds: Readonly<Record<string, number>> | null;
  /** A position is known and its times haven't arrived (or failed) yet. */
  pending: boolean;
}

/**
 * Driving times from the reader to every place, from the app's /api/drive-times
 * (a real router, one matrix request). Asks again only after a move of more than
 * REFETCH_METERS from where the last answer was for.
 */
export function useDriveTimes(position: Origin | null): DriveTimesState {
  const [state, setState] = useState<DriveTimesState>({ seconds: null, pending: false });
  const fetchedFor = useRef<Origin | null>(null);
  const requestId = useRef(0);
  const retryAt = useRef(0);
  const lat = position?.lat;
  const lng = position?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const here = { lat, lng };
    if (fetchedFor.current && metersBetween(fetchedFor.current, here) <= REFETCH_METERS) return;
    if (Date.now() < retryAt.current) return;
    fetchedFor.current = here;
    const id = ++requestId.current;
    const origin = snapOrigin(here);
    setState((s) => ({ ...s, pending: true }));
    fetch(`/api/drive-times?lat=${origin.lat}&lng=${origin.lng}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${response.status}`))))
      .then((body: { seconds: Record<string, number> }) => {
        if (id === requestId.current) setState({ seconds: body.seconds, pending: false });
      })
      .catch((error) => {
        console.warn("Drive times unavailable:", error);
        if (id === requestId.current) {
          fetchedFor.current = null;
          retryAt.current = Date.now() + RETRY_MS;
          setState((s) => ({ ...s, pending: false }));
        }
      });
  }, [lat, lng]);

  return state;
}

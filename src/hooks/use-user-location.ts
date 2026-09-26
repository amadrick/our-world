"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UserPosition {
  lat: number;
  lng: number;
  /** Radius of the 95% confidence circle, in meters. */
  accuracy: number;
}

export type LocationStatus =
  | "off"
  | "locating"
  | "on"
  | "denied"
  | "unavailable"
  | "timeout"
  | "insecure"
  | "unsupported";

interface LocationState {
  status: LocationStatus;
  position: UserPosition | null;
}

const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 };

/**
 * The reader's position, kept current with watchPosition. Browsers only ask for
 * permission from a user gesture, so `start` belongs in a tap handler; if the site
 * is already allowed, watching starts on its own and nothing is asked.
 */
export function useUserLocation() {
  const [state, setState] = useState<LocationState>({ status: "off", position: null });
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const start = useCallback(() => {
    if (!window.isSecureContext) return setState((s) => ({ ...s, status: "insecure" }));
    if (!("geolocation" in navigator)) return setState((s) => ({ ...s, status: "unsupported" }));
    if (watchId.current !== null) {
      setState((s) => (s.position ? s : { ...s, status: "locating" }));
      return;
    }
    setState((s) => ({ ...s, status: s.position ? "on" : "locating" }));
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) =>
        setState({
          status: "on",
          position: { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy },
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          stop();
          setState({ status: "denied", position: null });
          return;
        }
        // A slow or lost fix keeps the last known dot; the watch keeps trying.
        const status = error.code === error.TIMEOUT ? "timeout" : "unavailable";
        setState((s) => (s.position ? s : { ...s, status }));
        if (status === "unavailable") stop();
      },
      WATCH_OPTIONS,
    );
  }, [stop]);

  useEffect(() => {
    let cancelled = false;
    let permission: PermissionStatus | null = null;
    const onChange = () => {
      if (permission?.state === "granted") start();
      if (permission?.state === "denied") {
        stop();
        setState({ status: "denied", position: null });
      }
    };
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((result) => {
        if (cancelled) return;
        permission = result;
        result.addEventListener("change", onChange);
        if (result.state === "granted") start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      permission?.removeEventListener("change", onChange);
      stop();
    };
  }, [start, stop]);

  const dismiss = useCallback(
    () => setState((s) => (s.status === "on" || s.status === "locating" ? s : { ...s, status: s.position ? "on" : "off" })),
    [],
  );

  return { ...state, start, dismiss };
}

/** What to tell the reader when there is no dot to show, or null when there's nothing to say. */
export function locationMessage(status: LocationStatus): string | null {
  switch (status) {
    case "denied":
      return "Location is off for this site. Allow it in Settings › Apps › Safari › Location, then try again.";
    case "unavailable":
      return "Your location isn’t available right now.";
    case "timeout":
      return "Finding your location is taking too long. Try again in a moment.";
    case "insecure":
      return "Location needs a secure (https) connection.";
    case "unsupported":
      return "This browser can’t share your location.";
    default:
      return null;
  }
}

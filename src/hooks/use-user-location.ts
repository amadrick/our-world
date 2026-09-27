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
  /** The reader tapped locate since the last notice, so a problem is worth telling them about. */
  asked: boolean;
}

const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 };
/** A denial is remembered for the session, so a reload doesn't ask again. */
const DENIED_KEY = "location-denied";

function rememberDenied(denied: boolean) {
  try {
    if (denied) sessionStorage.setItem(DENIED_KEY, "1");
    else sessionStorage.removeItem(DENIED_KEY);
  } catch {
    // Storage can be off (private modes); then the browser's own answer is all there is.
  }
}

function deniedThisSession() {
  try {
    return sessionStorage.getItem(DENIED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The reader's position, kept current with watchPosition. Watching starts as the
 * explorer loads, so Safari asks right away and the dot and drive times can show
 * without a tap; a denial on load stays quiet and isn't asked again this session.
 * `start` is the locate button: it asks again and reports problems.
 */
export function useUserLocation() {
  const [state, setState] = useState<LocationState>({ status: "off", position: null, asked: false });
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  // Only registers the watch; every state change comes from its callbacks.
  const watch = useCallback(() => {
    if (watchId.current !== null || !window.isSecureContext || !("geolocation" in navigator)) return;
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        rememberDenied(false);
        setState({
          status: "on",
          position: { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy },
          asked: false,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          stop();
          rememberDenied(true);
          setState((s) => ({ status: "denied", position: null, asked: s.asked }));
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

  /** The locate button: asks again if needed, and any problem from here on is shown. */
  const start = useCallback(() => {
    if (!window.isSecureContext) return setState((s) => ({ ...s, status: "insecure", asked: true }));
    if (!("geolocation" in navigator)) return setState((s) => ({ ...s, status: "unsupported", asked: true }));
    setState((s) => ({ ...s, status: s.position ? "on" : "locating", asked: true }));
    watch();
  }, [watch]);

  useEffect(() => {
    let cancelled = false;
    let permission: PermissionStatus | null = null;
    const onChange = () => {
      if (permission?.state === "granted") watch();
      if (permission?.state === "denied") {
        stop();
        rememberDenied(true);
        setState((s) => ({ ...s, status: "denied", position: null }));
      }
    };
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((result) => {
        if (cancelled) return;
        permission = result;
        result.addEventListener("change", onChange);
      })
      .catch(() => {});
    if (!deniedThisSession()) watch();
    return () => {
      cancelled = true;
      permission?.removeEventListener("change", onChange);
      stop();
    };
  }, [watch, stop]);

  const dismiss = useCallback(() => setState((s) => ({ ...s, asked: false })), []);

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

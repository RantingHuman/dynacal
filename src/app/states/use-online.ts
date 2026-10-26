"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the browser is online. Offline, the installed app shows the week it last loaded, and nothing that
 * needs the server (anything that changes data) can be attempted. The server render assumes online.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Why a control that needs the server is disabled while offline. */
export const OFFLINE_REASON = "Offline: this needs a connection.";

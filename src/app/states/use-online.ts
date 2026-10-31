"use client";

import { useSyncExternalStore } from "react";

/** How often to look for the server while the app is open. */
const PROBE_EVERY_MS = 30_000;
const PROBE_TIMEOUT_MS = 5_000;

let serverOutOfReach = false;
let subscribers = 0;
let probeTimer: ReturnType<typeof setInterval> | undefined;

/**
 * A device on Wi-Fi says it's online even when dynacal's server can't be reached (its VPN is off, say), and the
 * service worker then shows the saved week as if nothing were wrong. So an app the worker controls, which could be
 * showing that saved week, asks the server itself. The worker leaves this request to the network, and the offline
 * page needs no session. Coming back fires "online", which also refreshes the week.
 */
async function probeServer() {
  if (!navigator.onLine || !navigator.serviceWorker?.controller || document.visibilityState !== "visible") return;
  let outOfReach = false;
  try {
    await fetch("/offline", { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
  } catch {
    outOfReach = true;
  }
  if (outOfReach === serverOutOfReach) return;
  serverOutOfReach = outOfReach;
  window.dispatchEvent(new Event(outOfReach ? "offline" : "online"));
}

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  if (subscribers++ === 0) {
    void probeServer();
    probeTimer = setInterval(probeServer, PROBE_EVERY_MS);
    document.addEventListener("visibilitychange", probeServer);
  }
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
    if (--subscribers === 0) {
      clearInterval(probeTimer);
      document.removeEventListener("visibilitychange", probeServer);
    }
  };
}

/**
 * Whether dynacal can reach its server. Offline, the installed app shows the week it last loaded, and nothing that
 * needs the server (anything that changes data) can be attempted. The server render assumes online.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine && !serverOutOfReach,
    () => true,
  );
}

/** Why a control that needs the server is disabled while offline. */
export const OFFLINE_REASON = "Offline: this needs a connection.";

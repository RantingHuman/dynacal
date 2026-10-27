"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { shouldRefresh } from "@/core/background-refresh";

/** How often to look for a moment to refresh; the timing rules themselves are in `shouldRefresh`. */
const CHECK_EVERY_MS = 5_000;

/** A focused field with something typed in it. An empty one (like the add line, focused on load) has nothing to lose. */
function isTyping(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return active.value !== "";
  return active instanceof HTMLElement && active.isContentEditable && (active.textContent ?? "") !== "";
}

/**
 * Something is in hand: a press, typing, or an open label, sheet, editor or menu (which mark themselves with
 * `data-refresh-hold`). A refresh then waits, so nothing changes under the owner's hand.
 */
function isBusy(pressing: boolean): boolean {
  return pressing || isTyping() || document.querySelector("[data-refresh-hold]") !== null;
}

/**
 * Keeps an open home screen up to date with changes made elsewhere (another device, or Google). It refreshes
 * when dynacal comes back into view, and once a minute while it's open and the owner is still. A refresh fetches
 * the page's data in place, so what's typed, open or scrolled stays put. Changes it brings in appear without
 * motion: `data-quiet-refresh` turns animations off until it has rendered (see globals), keeping motion for the
 * owner's own actions and never freezing input under a view transition.
 */
export function BackgroundRefresh() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const state = useRef({ lastRefresh: 0, lastInput: 0, requested: false, pressing: false });

  // Animations come back two frames after the refresh has rendered.
  useEffect(() => {
    if (refreshing || !("quietRefresh" in document.documentElement.dataset)) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => delete document.documentElement.dataset.quietRefresh);
    });
    return () => cancelAnimationFrame(frame);
  }, [refreshing]);

  useEffect(() => {
    const s = state.current;
    s.lastRefresh = s.lastInput = performance.now();

    const tryRefresh = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      const now = performance.now();
      const moment = { now, lastRefresh: s.lastRefresh, lastInput: s.lastInput, requested: s.requested, busy: isBusy(s.pressing) };
      if (!shouldRefresh(moment)) return;
      s.requested = false;
      s.lastRefresh = now;
      document.documentElement.dataset.quietRefresh = "";
      startRefresh(() => router.refresh());
    };
    const touched = () => {
      s.lastInput = performance.now();
    };
    const press = () => {
      s.pressing = true;
      touched();
    };
    const release = () => {
      s.pressing = false;
      touched();
    };
    const cameBack = () => {
      if (document.visibilityState !== "visible") return;
      s.requested = true;
      tryRefresh();
    };
    // A page restored from the back/forward cache is back in view without a fresh load.
    const shown = (e: PageTransitionEvent) => {
      if (e.persisted) cameBack();
    };

    window.addEventListener("pointerdown", press, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    window.addEventListener("keydown", touched, true);
    window.addEventListener("wheel", touched, { capture: true, passive: true });
    document.addEventListener("visibilitychange", cameBack);
    window.addEventListener("focus", cameBack);
    window.addEventListener("online", cameBack);
    window.addEventListener("pageshow", shown);
    const timer = setInterval(tryRefresh, CHECK_EVERY_MS);
    return () => {
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("keydown", touched, true);
      window.removeEventListener("wheel", touched, { capture: true });
      document.removeEventListener("visibilitychange", cameBack);
      window.removeEventListener("focus", cameBack);
      window.removeEventListener("online", cameBack);
      window.removeEventListener("pageshow", shown);
      clearInterval(timer);
    };
  }, [router]);

  return null;
}

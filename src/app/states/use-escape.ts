"use client";

import { useEffect } from "react";

/** Calls `onEscape` when Escape is pressed anywhere on the page, while `active`: how sheets, labels and menus close. */
export function useEscape(onEscape: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEscape, active]);
}

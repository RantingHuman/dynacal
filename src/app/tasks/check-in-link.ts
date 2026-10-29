"use client";

import { useEffect, useRef } from "react";
import { CHECK_IN_HREF } from "@/core/headline";

/**
 * Calls `open` with the Task's id when a link to its Check-in (the headline's "Check in", see `checkInHref`) is
 * followed anywhere on the page. The link is handled here rather than followed, so the address doesn't change
 * and tapping it again opens it again.
 */
export function useCheckInLink(open: (taskId: string) => void) {
  const latest = useRef(open);
  useEffect(() => {
    latest.current = open;
  });
  useEffect(() => {
    function follow(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest(`a[href^="${CHECK_IN_HREF}"]`) : null;
      if (!link) return;
      event.preventDefault();
      latest.current(link.getAttribute("href")!.slice(CHECK_IN_HREF.length));
    }
    document.addEventListener("click", follow);
    return () => document.removeEventListener("click", follow);
  }, []);
}

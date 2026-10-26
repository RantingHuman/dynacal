"use client";

import { useEffect, useState } from "react";

/** How long an action may take before its button shows "…". */
const SLOW_MS = 1000;

/** Whether `pending` has lasted more than a second, so a button can show "…" while its action is still working. */
export function useSlow(pending: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  return pending && slow;
}

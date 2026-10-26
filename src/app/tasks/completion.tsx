"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createSettle, REORDER_DELAY_MS } from "@/core/motion";

interface CompletionContext {
  /** Tasks ticked on this page, whose completion animates (a Task already complete on load doesn't). */
  ticked: ReadonlySet<string>;
  /** While true the Task list keeps its order, so rows don't jump under the pointer mid-burst. */
  holding: boolean;
  /** Notes a tick, from the Task list or a Block's check, before the change itself goes through `act`. */
  tick: (taskId: string) => void;
}

const Context = createContext<CompletionContext>({ ticked: new Set(), holding: false, tick: () => {} });

/**
 * The motion of completing a Task: the list holds its order until 600ms after the last tick, then lets completed
 * Tasks slide to the bottom (in a Transition, so the rows' `<ViewTransition>`s animate it). The delay restarts on
 * each tick, so a burst reorders once.
 */
export function CompletionProvider({ children }: { children: ReactNode }) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
  const [holding, setHolding] = useState(false);
  const [settle] = useState(() => createSettle(REORDER_DELAY_MS, () => startTransition(() => setHolding(false))));
  useEffect(() => () => settle.cancel(), [settle]);

  const tick = useCallback(
    (taskId: string) => {
      setTicked((prev) => new Set(prev).add(taskId));
      setHolding(true);
      settle.poke();
    },
    [settle],
  );

  const value = useMemo(() => ({ ticked, holding, tick }), [ticked, holding, tick]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCompletion(): CompletionContext {
  return useContext(Context);
}

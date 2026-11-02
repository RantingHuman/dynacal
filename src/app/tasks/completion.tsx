"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createSettle, REORDER_DELAY_MS } from "@/core/motion";

interface CompletionContext {
  /** Tasks whose tick is still playing, until it settles: a mark left on would replay whenever a row is shown again. */
  ticked: ReadonlySet<string>;
  /** While true the Task list keeps its order, so rows don't jump under the pointer mid-burst. */
  holding: boolean;
  /** Notes a tick, from the Task list or a Block's check, before the change itself goes through `act`. */
  tick: (taskId: string) => void;
  /** Notes a Task reopened (its tick taken back), which holds the list's order the same way. */
  untick: (taskId: string) => void;
}

const Context = createContext<CompletionContext>({ ticked: new Set(), holding: false, tick: () => {}, untick: () => {} });

/**
 * The motion of completing a Task: the list holds its order until 600ms after the last tick, then lets completed
 * Tasks slide to the bottom and reopened ones back up (in a Transition, so the rows' `<ViewTransition>`s animate
 * it), and the ticks' animations are over. The delay restarts on each tick, so a burst reorders once.
 */
export function CompletionProvider({ children }: { children: ReactNode }) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
  const [holding, setHolding] = useState(false);
  const [settle] = useState(() =>
    createSettle(REORDER_DELAY_MS, () =>
      startTransition(() => {
        setHolding(false);
        setTicked(new Set());
      }),
    ),
  );
  useEffect(() => () => settle.cancel(), [settle]);

  const tick = useCallback(
    (taskId: string) => {
      setTicked((prev) => new Set(prev).add(taskId));
      setHolding(true);
      settle.poke();
    },
    [settle],
  );

  const untick = useCallback(
    (taskId: string) => {
      setTicked((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setHolding(true);
      settle.poke();
    },
    [settle],
  );

  const value = useMemo(() => ({ ticked, holding, tick, untick }), [ticked, holding, tick, untick]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCompletion(): CompletionContext {
  return useContext(Context);
}

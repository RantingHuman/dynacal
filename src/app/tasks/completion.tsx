"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CompleteTaskResult } from "@/core/commands";
import { createSettle, REORDER_DELAY_MS } from "@/core/motion";
import { completeTask } from "./actions";

interface CompletionContext {
  /** Tasks ticked on this page: shown complete at once, before the server answers, and animated. */
  ticked: ReadonlySet<string>;
  /** While true the Task list keeps its order, so rows don't jump under the pointer mid-burst. */
  holding: boolean;
  complete: (taskId: string) => Promise<CompleteTaskResult>;
}

const Context = createContext<CompletionContext>({
  ticked: new Set(),
  holding: false,
  complete: completeTask,
});

/**
 * Completing a Task, from the Task list or a Block's check: the tick shows at once, and the list holds its order
 * until 600ms after the last tick, then lets completed Tasks slide to the bottom (in a Transition, so the rows'
 * `<ViewTransition>`s animate it).
 */
export function CompletionProvider({ children }: { children: ReactNode }) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
  const [holding, setHolding] = useState(false);
  const [settle] = useState(() => createSettle(REORDER_DELAY_MS, () => startTransition(() => setHolding(false))));
  useEffect(() => () => settle.cancel(), [settle]);

  const complete = useCallback(
    (taskId: string) => {
      setTicked((prev) => new Set(prev).add(taskId));
      setHolding(true);
      settle.poke();
      return new Promise<CompleteTaskResult>((resolve) => {
        startTransition(async () => {
          const result = await completeTask(taskId);
          // A Task that's gone can't be ticked; let it go back.
          if (!result.ok) setTicked((prev) => new Set([...prev].filter((id) => id !== taskId)));
          resolve(result);
        });
      });
    },
    [settle],
  );

  const value = useMemo(() => ({ ticked, holding, complete }), [ticked, holding, complete]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCompletion(): CompletionContext {
  return useContext(Context);
}

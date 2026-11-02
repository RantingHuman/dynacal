"use client";

import type { MoveToDayResult } from "@/core/day-moves";
import { addDays } from "@/core/time-zone";
import { moveTasksToDay, undoDayMove } from "./actions";
import { NOT_PLACED_WORDS } from "./check-in-answers";
import { movedToDayWords, todayIn } from "./day-words";
import { useTaskList } from "./task-list";

/** Why a move to a day was refused, in the owner's words. */
function refusalWords(result: MoveToDayResult & { ok: false }, title: string): string {
  return "notFound" in result ? `“${title}” was deleted or changed elsewhere.` : result.errors.deadline;
}

/**
 * Moving a Task to tomorrow through the Task List, so its new Earliest Start shows at once and a refusal rolls back
 * and says why. Once it's moved, a message says where it went and offers Undo.
 */
export function useMoveToTomorrow(): (task: { id: string; title: string }) => void {
  const { act, notify, timeZone } = useTaskList();
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return ({ id, title }) => {
    // Today as this device has it now: the page may have been open since yesterday.
    const today = todayIn(timeZone);
    const day = addDays(today, 1);
    act({ kind: "move-to-day", ids: [id], day }, async () => {
      const result = await moveTasksToDay([id], day);
      if (!result.ok) return refusalWords(result, title);
      const { undo } = result;
      const words =
        "recalculationPaused" in result
          ? NOT_PLACED_WORDS
          : movedToDayWords(result.moved[0].nextStart, result.moved[0].later === true, today, zone);
      notify(words, {
        label: "Undo",
        run: () =>
          act({ kind: "undo-day-move", undo }, async () => {
            await undoDayMove(undo);
            notify("Moved back");
            return null;
          }),
      });
      return null;
    });
  };
}

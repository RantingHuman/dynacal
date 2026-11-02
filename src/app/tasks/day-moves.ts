"use client";

import { addDays } from "@/core/time-zone";
import { moveTasksToDay, undoDayMove } from "./actions";
import { movedToDayWords, NOT_PLACED_WORDS, todayIn } from "./day-words";
import { useTaskList } from "./task-list";

/**
 * Moving a Task to tomorrow through the Task List, so its new Earliest Start shows at once and a refusal rolls back
 * and says why. If it's due before tomorrow, the due date question decides. Once it's moved, a message says where it
 * went and offers Undo.
 */
export function useMoveToTomorrow(): (task: { id: string; title: string }) => void {
  const { act, notify, askDueDate, timeZone } = useTaskList();
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return ({ id, title }) => {
    // Today as this device has it now: the page may have been open since yesterday.
    const today = todayIn(timeZone);
    const day = addDays(today, 1);
    const move = (moveDeadlines: boolean) =>
      act({ kind: "move-to-day", ids: [id], day, moveDeadlines }, async () => {
        const result = await (moveDeadlines ? moveTasksToDay([id], day, { moveDeadlines }) : moveTasksToDay([id], day));
        if (!result.ok) {
          if ("notFound" in result) return `“${title}” was deleted or changed elsewhere.`;
          askDueDate(result.dueBefore, () => move(true));
          return null;
        }
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
    move(false);
  };
}

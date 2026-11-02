"use client";

import { useState } from "react";
import type { MoveToDayResult } from "@/core/day-moves";
import { addDays } from "@/core/time-zone";
import { moveTasksToDay, undoDayMove } from "./actions";
import { movedBackWords, movedManyToDayWords, movedToDayWords, NOT_PLACED_WORDS, todayIn, zoneOrBrowser } from "./day-words";
import { useTaskList } from "./task-list";

/** A Task to move. */
type TaskToMove = { id: string; title: string };

/** What the message says about a move that was made. */
function movedMessage(result: MoveToDayResult & { ok: true }, today: string, timeZone: string): string {
  if ("recalculationPaused" in result) return NOT_PLACED_WORDS;
  const [first] = result.moved;
  return result.moved.length === 1
    ? movedToDayWords(first.nextStart, first.later === true, today, timeZone)
    : movedManyToDayWords(result.moved, today, timeZone);
}

/**
 * Moving Tasks to a day through the Task List, so their new Earliest Start shows at once and a refusal rolls back and
 * says why. If any is due before that day, one deadline question decides for them all. Once they're moved, one message
 * says where they went and offers one Undo, and `onMoved` runs. `moving` says a move is on its way.
 */
export function useMoveToDay() {
  const { act, notify, askMoveDeadlines, timeZone } = useTaskList();
  const zone = zoneOrBrowser(timeZone);
  const [moving, setMoving] = useState(false);

  function moveToDay(tasks: TaskToMove[], day: string, onMoved?: () => void) {
    const ids = tasks.map((t) => t.id);
    // Today as this device has it now: the page may have been open since yesterday.
    const today = todayIn(timeZone);
    const move = (moveDeadlines: boolean) => {
      setMoving(true);
      act({ kind: "move-to-day", ids, day, moveDeadlines }, async () => {
        try {
          const result = await moveTasksToDay(ids, day, { moveDeadlines });
          if (!result.ok) {
            if ("notFound" in result) {
              return tasks.length === 1
                ? `“${tasks[0].title}” was deleted or changed elsewhere.`
                : "A Task was deleted or changed elsewhere, so nothing moved.";
            }
            askMoveDeadlines(result.deadlineBefore, () => move(true));
            return null;
          }
          const { undo } = result;
          onMoved?.();
          notify(movedMessage(result, today, zone), {
            label: "Undo",
            run: () =>
              act({ kind: "undo-day-move", undo }, async () => {
                notify(movedBackWords(await undoDayMove(undo), undo.tasks.length));
                return null;
              }),
          });
          return null;
        } finally {
          setMoving(false);
        }
      });
    };
    move(false);
  }

  return { moveToDay, moving };
}

/** Moving one Task to tomorrow, as the Tomorrow button does. */
export function useMoveToTomorrow(): (task: TaskToMove) => void {
  const { timeZone } = useTaskList();
  const { moveToDay } = useMoveToDay();
  return (task) => moveToDay([task], addDays(todayIn(timeZone), 1));
}

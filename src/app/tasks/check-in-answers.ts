"use client";

import type { CheckInAnswer, CheckInResult } from "@/core/completion";
import { checkIn } from "./actions";
import { useCompletion } from "./completion";
import { useMoveToTomorrow } from "./day-moves";
import { movedWords, NOT_PLACED_WORDS, todayIn, zoneOrBrowser } from "./day-words";
import { useTaskList } from "./task-list";

/** The Task a Check-in is about. */
export interface CheckInTask {
  id: string;
  title: string;
}

/** Answering a Check-in about one past time (`blockId`) of a Task. */
export type CheckInAnswers = ReturnType<typeof useCheckInAnswers>;

/**
 * Answering a Check-in about one past time (`blockId`) of a Task, through the Task List, so the answer
 * shows at once wherever the Task does: Finished completes it, as when it's ticked; More time makes the minutes its
 * time left; Didn't start waits for the server's list, then a message says where the Task went; Tomorrow moves the
 * Task as the Schedule sheet's Tomorrow does, which answers its Check-ins as Didn't start, and asks about a deadline
 * before tomorrow.
 */
export function useCheckInAnswers() {
  const { act, timeZone, notify } = useTaskList();
  const { tick } = useCompletion();
  const moveToTomorrow = useMoveToTomorrow();
  const zone = zoneOrBrowser(timeZone);

  /** Sends the answer; null once it's taken, else why not (the Task went elsewhere, or the time is refused). */
  async function send(task: CheckInTask, blockId: string, answer: CheckInAnswer, taken?: (result: CheckInResult & { ok: true }) => void) {
    const result = await checkIn(blockId, answer);
    if (result.ok) {
      taken?.(result);
      return null;
    }
    if ("notFound" in result) return `“${task.title}” was deleted or changed elsewhere.`;
    return result.errors.block ?? result.errors.minutes ?? null;
  }

  return {
    finish(task: CheckInTask, blockId: string) {
      tick(task.id);
      act({ kind: "complete", id: task.id }, () => send(task, blockId, { answer: "finished" }));
    },
    moreTime(task: CheckInTask, blockId: string, minutes: number) {
      act({ kind: "more-time", id: task.id, blockId, minutes }, () =>
        send(task, blockId, { answer: "more-time", minutes }),
      );
    },
    didntStart(task: CheckInTask, blockId: string) {
      act(null, () =>
        send(task, blockId, { answer: "didnt-start" }, (result) =>
          notify(
            "recalculationPaused" in result
              ? NOT_PLACED_WORDS
              : movedWords(result.nextStart ?? null, "later" in result, todayIn(timeZone), zone),
          ),
        ),
      );
    },
    tomorrow: moveToTomorrow,
  };
}

/**
 * For the Schedule: the past times waiting for a Check-in by their Block, as the Task List has them (so an answer
 * shows at once, and a Splittable Task's planned time is there), and answering about them.
 */
export function useScheduleCheckIns() {
  const { tasks } = useTaskList();
  const waiting = new Map(tasks.flatMap((t) => (t.completedAt ? [] : t.checkIns.map((c) => [c.blockId, c] as const))));
  const answers = useCheckInAnswers();
  return { waiting, answers };
}

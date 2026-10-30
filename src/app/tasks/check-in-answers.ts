"use client";

import type { CheckInAnswer, CheckInResult } from "@/core/completion";
import { useTaskColumn, type ActOnTasks } from "./task-editor-slot";
import { checkIn } from "./actions";
import { useCompletion } from "./completion";
import { movedWords, todayIn } from "./day-words";

/** The Task a Check-in is about. */
export interface CheckInTask {
  id: string;
  title: string;
}

/** What Didn't start says while Recalculation is paused, so the Task wasn't placed anywhere. */
export const NOT_PLACED_WORDS = "Not placed yet: planning is paused until you reconnect Google";

/** Answering a Check-in about one past time (`blockId`) of a Task. */
export type CheckInAnswers = ReturnType<typeof useCheckInAnswers>;

/**
 * Answering a Check-in about one past time (`blockId`) of a Task, through the Task list's `act`, so the answer
 * shows at once wherever the Task does: Finished completes it, as when it's ticked; More time makes the minutes its
 * time left; Didn't start waits for the server's list, then `notify` says where the Task went.
 */
export function useCheckInAnswers(act: ActOnTasks, timeZone: string | null, notify: (text: string) => void) {
  const { tick } = useCompletion();
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

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
  };
}

/**
 * For the Schedule: the past times waiting for a Check-in by their Block, as the Task list has them (so an answer
 * shows at once, and a Splittable Task's planned time is there), and answering about them. Until the Tasks column
 * has published its Tasks, nothing waits.
 */
export function useScheduleCheckIns(timeZone: string, notify: (text: string) => void) {
  const column = useTaskColumn();
  const waiting = new Map(
    column?.tasks.flatMap((t) => (t.completedAt ? [] : t.checkIns.map((c) => [c.blockId, c] as const))),
  );
  const answers = useCheckInAnswers(column?.act ?? (() => {}), timeZone, notify);
  return { waiting, answers };
}

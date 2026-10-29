"use client";

import { useTaskColumn, type ActOnTasks } from "./task-editor-slot";
import { checkIn } from "./actions";
import { useCompletion } from "./completion";
import { movedWords, todayIn } from "./day-words";

/** The Task a Check-in is about. */
interface CheckInTask {
  id: string;
  title: string;
}

/**
 * Answering a Check-in about one past time (`blockId`) of a Task, through the Task list's `act`, so the answer
 * shows at once wherever the Task does: Finished completes it, as when it's ticked; More time makes the minutes its
 * time left; Didn't start waits for the server's list, then `notify` says where the Task went.
 */
export function useCheckInAnswers(act: ActOnTasks, timeZone: string | null, notify: (text: string) => void) {
  const { tick } = useCompletion();
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const gone = (task: CheckInTask) => `“${task.title}” was deleted or changed elsewhere.`;
  return {
    finish(task: CheckInTask, blockId: string) {
      tick(task.id);
      act({ kind: "complete", id: task.id }, async () => {
        const result = await checkIn(blockId, { answer: "finished" });
        if (result.ok) return null;
        if ("notFound" in result) return gone(task);
        return result.errors.block ?? null;
      });
    },
    moreTime(task: CheckInTask, blockId: string, minutes: number) {
      act({ kind: "more-time", id: task.id, blockId, minutes }, async () => {
        const result = await checkIn(blockId, { answer: "more-time", minutes });
        if (result.ok) return null;
        if ("notFound" in result) return gone(task);
        return result.errors.block ?? result.errors.minutes ?? null;
      });
    },
    didntStart(task: CheckInTask, blockId: string) {
      act(null, async () => {
        const result = await checkIn(blockId, { answer: "didnt-start" });
        if (result.ok) {
          notify(movedWords(result.nextStart ?? null, todayIn(timeZone), zone));
          return null;
        }
        if ("notFound" in result) return gone(task);
        return result.errors.block ?? null;
      });
    },
  };
}

/** A time on the Schedule, as far as its Check-in needs. */
interface ScheduledTime {
  id: string;
  taskId: string;
  taskTitle: string;
}

/**
 * For the Schedule: the past times waiting for a Check-in, as the Task list has them (so an answer shows at once),
 * and answering about one of them. Until the Tasks column has published its Tasks, nothing waits.
 */
export function useScheduleCheckIns(timeZone: string, notify: (text: string) => void) {
  const column = useTaskColumn();
  const waiting = new Set(column?.tasks.flatMap((t) => (t.completedAt ? [] : t.checkIns.map((c) => c.blockId))));
  const answers = useCheckInAnswers(column?.act ?? (() => {}), timeZone, notify);
  const taskOf = (time: ScheduledTime) => ({ id: time.taskId, title: time.taskTitle });
  return {
    waiting,
    finish: (time: ScheduledTime) => answers.finish(taskOf(time), time.id),
    moreTime: (time: ScheduledTime, minutes: number) => answers.moreTime(taskOf(time), time.id, minutes),
    didntStart: (time: ScheduledTime) => answers.didntStart(taskOf(time), time.id),
  };
}

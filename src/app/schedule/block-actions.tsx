"use client";

import { useState, useTransition } from "react";
import type { MoveBlockResult } from "@/core/pinning";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { useCompleteTask } from "../tasks/complete-task-button";
import { useMoveToTomorrow } from "../tasks/day-moves";
import { pinnedWords, todayIn } from "../tasks/day-words";
import { useTaskList } from "../tasks/task-list";
import { moveBlock, unpinBlock } from "./actions";
import type { CalendarBlock, CalendarEvent } from "./calendar";
import { LabelNote } from "./floating-label";

/** Minutes after midnight from a time input's "HH:MM". */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** The message to show for a refused move of one of the Task `title`'s times. */
export function moveError(result: MoveBlockResult, title: string): string | null {
  if (result.ok) return null;
  if ("notFound" in result) return `Couldn't move “${title}”: its time changed elsewhere.`;
  return result.errors.block ?? result.errors.start ?? result.errors.end ?? `Couldn't move “${title}”.`;
}

/**
 * Says where a moved Block was pinned, with an Undo that puts back its old time and, if it wasn't pinned before, hands
 * it back to dynacal. `block` is the Block as it was before the move; `words` replaces the usual message.
 */
export function useSayPinned(): (block: CalendarBlock, to: { start: Date; end: Date }, words?: string) => void {
  const { act, notify, timeZone } = useTaskList();
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (block, to, words) =>
    notify(words ?? pinnedWords(to.start, todayIn(timeZone), zone), {
      label: "Undo",
      run: () =>
        act(null, async () => {
          const refused = moveError(await moveBlock(block.id, { start: block.start, end: block.end }), block.taskTitle);
          if (refused) return refused;
          if (!block.pinned) await unpinBlock(block.id);
          notify("Moved back");
          return null;
        }),
    });
}

/**
 * What the Block label (desktop) and the Block sheet (phone) can do to an open Block: move it (which pins it),
 * unpin it, mark its whole Task done, or send its Task to tomorrow. Offline none of them can be attempted: `disabled` is set and `title`
 * says why. A refusal shows in `error`.
 */
export function useBlockActions(block: CalendarBlock, onClose: () => void) {
  const online = useOnline();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const complete = useCompleteTask();
  const moveToTomorrow = useMoveToTomorrow();
  const sayPinned = useSayPinned();
  const { notify } = useTaskList();

  /** Moves the Block to the given span; `onMoved` runs once the move is saved, and a message says where it is. */
  function move(to: { start: Date; end: Date }, onMoved: () => void) {
    setError(null);
    startTransition(async () => {
      const message = moveError(
        await moveBlock(block.id, { start: to.start.toISOString(), end: to.end.toISOString() }),
        block.taskTitle,
      );
      setError(message);
      if (message) return;
      sayPinned(block, to);
      onMoved();
    });
  }

  function unpin() {
    setError(null);
    startTransition(async () => {
      const result = await unpinBlock(block.id);
      if (result.ok) {
        notify("Unpinned. dynacal picks the time.");
        onClose();
      } else setError(`Couldn't unpin “${block.taskTitle}”: its time changed elsewhere.`);
    });
  }

  /** Completes the Block's whole Task, as ticking it in the Task list does, and closes. */
  function markTaskDone() {
    setError(null);
    complete({ id: block.taskId, title: block.taskTitle });
    onClose();
  }

  /** Moves the Block's whole Task to tomorrow, where dynacal picks its time, and closes. A message says what happened. */
  function tomorrow() {
    setError(null);
    moveToTomorrow({ id: block.taskId, title: block.taskTitle });
    onClose();
  }

  return {
    move,
    unpin,
    markTaskDone,
    tomorrow,
    error,
    pending,
    /** For every control that changes the Block: while one runs, and offline. */
    disabled: pending || !online,
    /** Why the controls are disabled offline. */
    title: online ? undefined : OFFLINE_REASON,
  };
}

/** Names the Events a Pinned Block is in a Conflict with. */
export function BlockConflictNote({ conflicts }: { conflicts: CalendarEvent[] }) {
  if (conflicts.length === 0) return null;
  return (
    <LabelNote alert>
      Conflict: this pinned time overlaps {conflicts.map((c) => c.title).join(", ")}.
    </LabelNote>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { MoveBlockResult } from "@/core/pinning";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { useCompleteTask } from "../tasks/complete-task-button";
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
 * What the Block label (desktop) and the Block sheet (phone) can do to an open Block: move it (which pins it),
 * unpin it, or mark its whole Task done. Offline none of them can be attempted: `disabled` is set and `title`
 * says why. A refusal shows in `error`.
 */
export function useBlockActions(block: CalendarBlock, onClose: () => void) {
  const online = useOnline();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const complete = useCompleteTask();

  /** Moves the Block to the given span; `onMoved` runs once the move is saved. */
  function move(to: { start: Date; end: Date }, onMoved: () => void) {
    setError(null);
    startTransition(async () => {
      const message = moveError(
        await moveBlock(block.id, { start: to.start.toISOString(), end: to.end.toISOString() }),
        block.taskTitle,
      );
      setError(message);
      if (!message) onMoved();
    });
  }

  function unpin() {
    setError(null);
    startTransition(async () => {
      const result = await unpinBlock(block.id);
      if (result.ok) onClose();
      else setError(`Couldn't unpin “${block.taskTitle}”: its time changed elsewhere.`);
    });
  }

  /** Completes the Block's whole Task, as ticking it in the Task list does, and closes. */
  function markTaskDone() {
    setError(null);
    complete({ id: block.taskId, title: block.taskTitle }, setError);
    onClose();
  }

  return {
    move,
    unpin,
    markTaskDone,
    error,
    pending,
    /** For every control that changes the Block: while one runs, and offline. */
    disabled: pending || !online,
    /** Why the controls are disabled offline. */
    title: online ? undefined : OFFLINE_REASON,
  };
}

/** Names the Events a Pinned Block is in a Conflict with; `advice` adds what to do about it. */
export function BlockConflictNote({ conflicts, advice = false }: { conflicts: CalendarEvent[]; advice?: boolean }) {
  if (conflicts.length === 0) return null;
  return (
    <LabelNote alert>
      Conflict: this pinned time overlaps {conflicts.map((c) => c.title).join(", ")}.
      {advice && " dynacal won’t move it; move it, shorten it or unpin it, or change the Event in your calendar."}
    </LabelNote>
  );
}

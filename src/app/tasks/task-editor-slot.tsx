"use client";

import { useCallback, useEffect, useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { spanLabel } from "@/core/day-labels";
import { BlockEditor } from "../schedule/block-editor";
import type { CalendarBlock, CalendarConflict, CalendarEvent } from "../schedule/calendar";
import { eventsInConflict } from "../schedule/conflict-strip";
import { TaskEditor } from "./task-editor";
import { useTaskEditor } from "./task-editor-context";
import editorStyles from "./task-editor.module.css";
import { useTaskList } from "./task-list";

/** What the Task screen needs from the Schedule, for its When lines. */
export interface TaskScreenSchedule {
  timeZone: string;
  horizon: { start: string };
  blocks: CalendarBlock[];
  events: CalendarEvent[];
  conflicts: CalendarConflict[];
}

/**
 * Shows the Task editor in place of the calendar column's content while a Task is open. The calendar stays
 * mounted, hidden, so it keeps its state. A When line opens `Sheet` over the editor, which stays mounted under it, so
 * what's typed is kept.
 */
export function TaskEditorSlot({
  schedule = null,
  Sheet = BlockEditor,
  children,
}: {
  schedule?: TaskScreenSchedule | null;
  /** What a When line opens: the computer's label unless the layout has its own. */
  Sheet?: ComponentType<ComponentProps<typeof BlockEditor>>;
  children: ReactNode;
}) {
  const { open, close, back, asking, discard, keepEditing, draft, markSaved } = useTaskEditor();
  const { contexts, tasks, savedTasks, flags, timeZone, today, defaultBuffers, act } = useTaskList();
  const task = open?.taskId ? (tasks.find((t) => t.id === open.taskId) ?? null) : null;
  const gone = open?.taskId != null && task === null;

  // A Task deleted while its page is open (here or elsewhere) closes the page.
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  const [sheetBlockId, setSheetBlockId] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSheetBlockId(null), []);

  const showing = open !== null && !gone;
  const now = schedule ? new Date(schedule.horizon.start).getTime() : 0;
  const blocks =
    schedule && task && !task.completedAt
      ? schedule.blocks
          .filter((b) => b.taskId === task.id && new Date(b.end).getTime() > now)
          .toSorted((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      : [];
  const sheetBlock = blocks.find((b) => b.id === sheetBlockId);

  return (
    <>
      {showing && (
        <TaskEditor
          key={open.key}
          task={task}
          saved={savedTasks.find((t) => t.id === open.taskId) ?? null}
          initial={open.initial}
          contexts={contexts}
          flag={task ? (flags[task.id] ?? null) : null}
          times={blocks.map((block) => ({
            id: block.id,
            words: spanLabel(block, schedule!.timeZone),
            onOpen: () => setSheetBlockId(block.id),
          }))}
          timeZone={timeZone}
          today={today}
          defaultBuffers={defaultBuffers}
          act={act}
          draft={draft}
          asking={asking}
          onBack={back}
          onDiscard={discard}
          onKeepEditing={keepEditing}
          onClose={close}
          onSaved={markSaved}
          onAdded={open.onAdded}
        />
      )}
      {showing && schedule && sheetBlock && (
        <Sheet
          key={sheetBlock.id}
          block={sheetBlock}
          timeZone={schedule.timeZone}
          conflicts={eventsInConflict(sheetBlock.id, schedule.conflicts, schedule.events)}
          onClose={closeSheet}
        />
      )}
      {/* Shown again, it fades back in: a hidden element's animation restarts when it's shown. */}
      <div hidden={showing} className={editorStyles.back}>
        {children}
      </div>
    </>
  );
}

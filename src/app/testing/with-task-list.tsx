import type { ComponentProps, ReactNode } from "react";
import { TaskEditorProvider } from "../tasks/task-editor-slot";
import { TaskListProvider } from "../tasks/task-list";
import { workContext } from "./fixtures";

/** What the home page wraps both layouts in, with one Context and London time unless a test says otherwise. */
export function WithTaskList({
  children,
  contexts = [workContext],
  tasks = [],
  flags = {},
  timeZone = "Europe/London",
  defaultBuffers = { before: 0, after: 15 },
}: Partial<ComponentProps<typeof TaskListProvider>> & { children: ReactNode }) {
  return (
    <TaskListProvider contexts={contexts} tasks={tasks} flags={flags} timeZone={timeZone} defaultBuffers={defaultBuffers}>
      <TaskEditorProvider>{children}</TaskEditorProvider>
    </TaskListProvider>
  );
}

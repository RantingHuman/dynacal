"use client";

import { useState } from "react";
import type { TaskListItem } from "@/core/commands";
import { PRIORITY_LABELS, formatDateOrDateTime, formatDuration, type Task } from "@/core/tasks";
import type { TaskFlag } from "@/core/scheduler";
import { CompleteTaskButton } from "./complete-task-button";
import completion from "./completion.module.css";
import { TaskForm } from "./task-form";

const FLAG_LABELS: Record<TaskFlag, string> = {
  "at-risk": "At Risk",
  overdue: "Overdue",
  unscheduled: "Unscheduled",
};

type Editing = { mode: "closed" } | { mode: "new" } | { mode: "edit"; task: Task };

export function TaskPanel({ tasks, flags }: { tasks: TaskListItem[]; flags: Record<string, TaskFlag | null> }) {
  const [editing, setEditing] = useState<Editing>({ mode: "closed" });

  return (
    <section className="task-panel" aria-labelledby="tasks-heading">
      <div className="panel-header">
        <h2 id="tasks-heading">Tasks</h2>
        {editing.mode === "closed" && (
          <button className="button" type="button" onClick={() => setEditing({ mode: "new" })}>
            New Task
          </button>
        )}
      </div>

      {editing.mode !== "closed" && (
        <TaskForm
          key={editing.mode === "edit" ? editing.task.id : "new"}
          task={editing.mode === "edit" ? editing.task : null}
          onDone={() => setEditing({ mode: "closed" })}
        />
      )}

      {tasks.length === 0 ? (
        <p className="muted">No Tasks yet. Add one to get started.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={`${completion.item}${task.completedAt ? ` ${completion.completed}` : ""}`}>
              <CompleteTaskButton id={task.id} title={task.title} completed={task.completedAt !== null} />
              <button
                type="button"
                className={`task-row${editing.mode === "edit" && editing.task.id === task.id ? " selected" : ""}`}
                onClick={() => setEditing({ mode: "edit", task })}
              >
                <span className="task-title-row">
                  <span className="task-title">{task.title}</span>
                  {flags[task.id] && (
                    <span className={`flag flag-${flags[task.id]}`}>{FLAG_LABELS[flags[task.id]!]}</span>
                  )}
                </span>
                <span className="task-meta">
                  <span className={`priority priority-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
                  {task.completedAt ? (
                    <span>Complete</span>
                  ) : (
                    <span title="Remaining Duration of the estimated duration">
                      {formatDuration(task.remainingMinutes)} of {formatDuration(task.estimatedMinutes)} remaining
                    </span>
                  )}
                  {task.deadline && <span>Due {formatDateOrDateTime(task.deadline)}</span>}
                  {task.earliestStart && <span>From {formatDateOrDateTime(task.earliestStart)}</span>}
                  {task.dontSplit && <span>Don’t split</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

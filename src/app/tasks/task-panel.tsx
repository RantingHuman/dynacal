"use client";

import { useState } from "react";
import { PRIORITY_LABELS, formatDateOrDateTime, formatDuration, type Task } from "@/core/tasks";
import { TaskForm } from "./task-form";

type Editing = { mode: "closed" } | { mode: "new" } | { mode: "edit"; task: Task };

export function TaskPanel({ tasks }: { tasks: Task[] }) {
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
            <li key={task.id}>
              <button
                type="button"
                className={`task-row${editing.mode === "edit" && editing.task.id === task.id ? " selected" : ""}`}
                onClick={() => setEditing({ mode: "edit", task })}
              >
                <span className="task-title">{task.title}</span>
                <span className="task-meta">
                  <span className={`priority priority-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
                  <span>{formatDuration(task.estimatedMinutes)}</span>
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

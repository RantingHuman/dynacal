import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { checkInState, waitingForCheckIn } from "./check-in-state";
import { blocks, tasks } from "./db/schema";
import { createTestApp } from "./testing";

const now = new Date("2026-01-05T12:00:00Z");
const ended = new Date("2026-01-05T11:00:00Z");
const later = new Date("2026-01-05T13:00:00Z");
const open = { completedAt: null };
const completed = { completedAt: ended };

describe("where a Block stands with its Check-in", () => {
  it("hasn't ended while its time is still to come or in progress", () => {
    expect(checkInState({ end: later, review: null }, open, now)).toBe("not-ended");
  });

  it("goes by the answer, then the Task, before the time", () => {
    expect(checkInState({ end: later, review: "finished" }, open, now)).toBe("answered");
    expect(checkInState({ end: later, review: null }, completed, now)).toBe("task-closed");
  });

  it("is waiting once its time has ended unanswered and its Task is open, ending exactly now included", () => {
    expect(checkInState({ end: ended, review: null }, open, now)).toBe("waiting");
    expect(checkInState({ end: now, review: null }, open, now)).toBe("waiting");
  });

  it("is answered once the owner has answered for it, old reviews included", () => {
    for (const review of ["finished", "more-time", "done", "partial"] as const) {
      expect(checkInState({ end: ended, review }, open, now)).toBe("answered");
      expect(checkInState({ end: ended, review }, completed, now)).toBe("answered");
    }
  });

  it("won't be asked about once its Task is completed or deleted", () => {
    expect(checkInState({ end: ended, review: null }, completed, now)).toBe("task-closed");
    expect(checkInState({ end: ended, review: null }, null, now)).toBe("task-closed");
  });

  it("says the same in a query as in code", () => {
    const { db, commands } = createTestApp();
    const [{ id: contextId }] = commands.listContexts();
    const addTask = (id: string, completedAt: Date | null) =>
      db.insert(tasks).values({ id, title: id, notes: "", estimatedMinutes: 60, priority: "medium", splittable: false, createdAt: ended, completedAt, contextId }).run();
    addTask("open", null);
    addTask("completed", ended);
    const cases = [
      { id: "ahead", taskId: "open", end: later, review: null },
      { id: "waiting", taskId: "open", end: ended, review: null },
      { id: "answered", taskId: "open", end: ended, review: "more-time" as const },
      { id: "closed", taskId: "completed", end: ended, review: null },
    ];
    for (const { id, taskId, end, review } of cases) {
      db.insert(blocks).values({ id, taskId, start: new Date(end.getTime() - 3_600_000), end, review, pinned: false }).run();
    }

    const inQuery = db
      .select({ id: blocks.id })
      .from(blocks)
      .innerJoin(tasks, eq(blocks.taskId, tasks.id))
      .where(waitingForCheckIn(now))
      .all()
      .map((b) => b.id);
    const inCode = cases
      .filter((b) => checkInState(b, b.taskId === "open" ? open : completed, now) === "waiting")
      .map((b) => b.id);
    expect(inQuery).toEqual(["waiting"]);
    expect(inQuery).toEqual(inCode);
  });
});

// @vitest-environment jsdom

import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskDeadlineBefore } from "@/core/day-moves";
import { OFFLINE_REASON } from "../states/use-online";
import { renderGuarded } from "../testing/render";
import { WithTaskList } from "../testing/with-task-list";
import { useTaskList } from "./task-list";

// A Tuesday: 27 October 2026, London time.
const NOW = new Date("2026-10-27T09:00:00.000Z");

const dueOn = (date: string, time: string | null = null, title = "Write report"): TaskDeadlineBefore => ({
  id: title,
  title,
  deadline: { date, time },
});

/** Stands for whatever move brings the question up: pressing it asks. */
function Asker({ deadlineBefore, onMoveBoth }: { deadlineBefore: TaskDeadlineBefore[]; onMoveBoth: () => void }) {
  const { askMoveDeadlines } = useTaskList();
  return (
    <button type="button" onClick={() => askMoveDeadlines(deadlineBefore, onMoveBoth)}>
      Ask
    </button>
  );
}

async function ask(...deadlineBefore: TaskDeadlineBefore[]) {
  const onMoveBoth = vi.fn();
  renderGuarded(
    <WithTaskList>
      <Asker deadlineBefore={deadlineBefore} onMoveBoth={onMoveBoth} />
    </WithTaskList>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  return onMoveBoth;
}

describe("the deadline question", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("asks about a Task due today, with Move both or Cancel", async () => {
    await ask(dueOn("2026-10-27"));

    const question = screen.getByRole("alertdialog", { name: "Due today. Move the due date too?" });
    expect(within(question).getAllByRole("button").map((b) => b.textContent)).toEqual(["Move both", "Cancel"]);
  });

  it.each([
    ["2026-10-28", null, "Due tomorrow. Move the due date too?"],
    ["2026-10-30", null, "Due Fri. Move the due date too?"],
    ["2026-11-20", null, "Due 20 Nov. Move the due date too?"],
    ["2026-10-26", null, "Was due yesterday. Move the due date too?"],
    ["2026-10-27", "16:00", "Due today 16:00. Move the due date too?"],
  ])("names the Task's real due day: %s %s", async (date, time, words) => {
    await ask(dueOn(date, time));

    expect(screen.getByRole("alertdialog", { name: words })).toBeTruthy();
  });

  it("asks one question covering several Tasks, naming each", async () => {
    await ask(dueOn("2026-10-27"), dueOn("2026-10-28", null, "Call Sam"));

    const question = screen.getByRole("alertdialog", { name: "2 Tasks due earlier. Move the due dates too?" });
    expect(within(question).getAllByRole("listitem").map((i) => i.textContent)).toEqual([
      "Write report, due today",
      "Call Sam, due tomorrow",
    ]);
  });

  it("does what was asked on Move both, and goes", async () => {
    const onMoveBoth = await ask(dueOn("2026-10-27"));

    await userEvent.click(screen.getByRole("button", { name: "Move both" }));

    expect(onMoveBoth).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("does nothing on Cancel, and goes", async () => {
    const onMoveBoth = await ask(dueOn("2026-10-27"));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onMoveBoth).not.toHaveBeenCalled();
  });

  it("counts Escape and a tap outside it as Cancel", async () => {
    const onMoveBoth = await ask(dueOn("2026-10-27"));

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    await userEvent.click(screen.getByRole("alertdialog"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    expect(onMoveBoth).not.toHaveBeenCalled();
  });

  it("starts on Cancel, so a stray Enter moves nothing, and keeps Tab inside", async () => {
    await ask(dueOn("2026-10-27"));
    const question = screen.getByRole("alertdialog");

    expect(document.activeElement).toBe(within(question).getByRole("button", { name: "Cancel" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(within(question).getByRole("button", { name: "Move both" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(within(question).getByRole("button", { name: "Cancel" }));
  });

  it("can't move both offline, saying why, though Cancel still works", async () => {
    await ask(dueOn("2026-10-27"));

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByRole("button", { name: "Move both" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Move both" }).title).toBe(OFFLINE_REASON);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", false);
  });
});

// @vitest-environment jsdom

import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskListItem } from "@/core/commands";
import { deepWorkContext, taskItem, workContext } from "../testing/fixtures";
import { renderGuarded } from "../testing/render";
import { WithTaskList } from "../testing/with-task-list";
import { updateTask } from "./actions";
import { TaskEditorSlot } from "./task-editor-slot";
import { TaskPanel } from "./task-panel";

vi.mock("./actions", () => ({
  createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(), completeTask: vi.fn(), clearDeclinedTime: vi.fn(),
}));

// Today is Tuesday 27 October 2026.
const TODAY = "2026-10-27";

const task = taskItem({ id: "task-1", title: "Write planning doc" });

function renderScreen(item: TaskListItem = task, { contexts = [workContext], flags = {} } = {}) {
  return renderGuarded(
    <WithTaskList contexts={contexts} tasks={[item]} flags={flags} today={TODAY}>
      <TaskPanel />
      <TaskEditorSlot><div>Calendar</div></TaskEditorSlot>
    </WithTaskList>,
  );
}

async function openScreen() {
  await userEvent.click(screen.getByRole("button", { name: /^Write planning doc/ }));
  return within(screen.getByRole("form", { name: "Edit Task" }));
}

type Screen = Awaited<ReturnType<typeof openScreen>>;

const line = (editor: Screen, name: string) => editor.getByRole("button", { name: new RegExp(`^${name}, `) });

/** Saves, and gives back what the save sent. */
async function saved(editor: Screen) {
  vi.mocked(updateTask).mockResolvedValue({ ok: true, task });
  await userEvent.click(editor.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(updateTask).toHaveReturned());
  return vi.mocked(updateTask).mock.calls[0][1];
}

beforeEach(() => {
  vi.mocked(updateTask).mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T14:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("each everyday field is one line", () => {
  it("shows How long, Due, Earliest Start and Priority with their values in words", async () => {
    renderScreen({
      ...task,
      estimatedMinutes: 120,
      deadline: { date: "2026-10-28", time: "16:00" },
      earliestStart: { date: "2026-11-06", time: null },
      priority: "high",
    });
    const editor = await openScreen();

    expect(line(editor, "How long").getAttribute("aria-label")).toBe("How long, 2h");
    expect(line(editor, "Due").getAttribute("aria-label")).toBe("Due, Wed 28 Oct, 16:00");
    expect(line(editor, "Earliest Start").getAttribute("aria-label")).toBe("Earliest Start, Fri 6 Nov");
    expect(line(editor, "Priority").getAttribute("aria-label")).toBe("Priority, High");
  });

  it("says when there's no deadline and no Earliest Start", async () => {
    renderScreen();
    const editor = await openScreen();

    expect(line(editor, "Due").textContent).toContain("No deadline");
    expect(line(editor, "Earliest Start").textContent).toContain("Any time");
  });

  it("has no Context line with one Context", async () => {
    renderScreen();
    const editor = await openScreen();

    expect(editor.queryByRole("button", { name: /^Context/ })).toBeNull();
  });

  it("has a Context line with several, and a choice moves the Task when saved", async () => {
    renderScreen(task, { contexts: [workContext, deepWorkContext] });
    const editor = await openScreen();

    await userEvent.click(line(editor, "Context"));
    await userEvent.click(editor.getByRole("radio", { name: "Deep work" }));

    expect(line(editor, "Context").textContent).toContain("Deep work");
    expect(await saved(editor)).toEqual(expect.objectContaining({ contextId: "deep" }));
  });

  it("announces whether a line is open", async () => {
    renderScreen();
    const editor = await openScreen();
    const howLong = line(editor, "How long");
    expect(howLong.getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(howLong);

    expect(howLong.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("under the title", () => {
  it("shows a flag but not the time left, which How long already says", async () => {
    renderScreen({ ...task, remainingMinutes: 30 }, { flags: { "task-1": "overdue" } });
    const editor = await openScreen();

    expect(editor.getByText("Overdue")).toBeTruthy();
    expect(editor.queryByText(/left/)).toBeNull();
  });

  it("names no Context, which its line already says", async () => {
    renderScreen({ ...task, contextId: "deep" }, { contexts: [workContext, deepWorkContext] });
    const editor = await openScreen();

    expect(line(editor, "Context").textContent).toContain("Deep work");
    expect(editor.getAllByText("Deep work")).toHaveLength(1);
  });
});

describe("changing a field", () => {
  it("opens one line at a time", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "How long"));
    expect(editor.getByRole("button", { name: "15m" })).toBeTruthy();

    await userEvent.click(line(editor, "Priority"));
    expect(editor.getByRole("radio", { name: "Critical" })).toBeTruthy();
    expect(editor.queryByRole("button", { name: "15m" })).toBeNull();
  });

  it("closes an open line when it's tapped again, changing nothing", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "Priority"));
    await userEvent.click(line(editor, "Priority"));

    expect(editor.queryByRole("radio", { name: "Critical" })).toBeNull();
    expect(line(editor, "Priority").textContent).toContain("Medium");
  });

  it("sets a choice and closes the line, handing focus back to it", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "Priority"));
    await userEvent.click(editor.getByRole("radio", { name: "Critical" }));

    expect(editor.queryByRole("radio", { name: "Critical" })).toBeNull();
    expect(line(editor, "Priority").textContent).toContain("Critical");
    expect(document.activeElement).toBe(line(editor, "Priority"));
    expect(await saved(editor)).toEqual(expect.objectContaining({ priority: "critical" }));
  });

  it("keeps Priority's four levels", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "Priority"));

    expect(editor.getAllByRole("radio").map((c) => c.textContent)).toEqual(["Low", "Medium", "High", "Critical"]);
  });
});

describe("How long", () => {
  it("offers 15m, 30m, 1h, 2h, 4h and Other", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "How long"));

    const choices = within(editor.getByRole("group", { name: "Estimated duration" })).getAllByRole("button");
    expect(choices.map((c) => c.textContent)).toEqual(["15m", "30m", "1h", "2h", "4h", "Other"]);
    expect(editor.getByRole("button", { name: "1h" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("sets a length and closes", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "How long"));
    await userEvent.click(editor.getByRole("button", { name: "4h" }));

    expect(editor.queryByRole("button", { name: "4h" })).toBeNull();
    expect(line(editor, "How long").textContent).toContain("4h");
    expect(await saved(editor)).toEqual(expect.objectContaining({ estimatedMinutes: 240 }));
  });

  it("stays open under Other while a length is typed, even through one of the listed lengths", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "How long"));
    await userEvent.click(editor.getByRole("button", { name: "Other" }));
    const other = editor.getByRole("spinbutton", { name: "Other duration in minutes" });
    // 30 is on the list, on the way to 300.
    await userEvent.type(other, "300");

    expect(other).toHaveProperty("value", "300");
    expect(line(editor, "How long").textContent).toContain("5h");
    expect(await saved(editor)).toEqual(expect.objectContaining({ estimatedMinutes: 300 }));
  });

  it("keeps showing a stored length that isn't on the list, without changing it", async () => {
    renderScreen({ ...task, estimatedMinutes: 45 });
    const editor = await openScreen();
    expect(line(editor, "How long").textContent).toContain("45m");

    await userEvent.click(line(editor, "How long"));

    expect(editor.getByRole("button", { name: "Other" }).getAttribute("aria-pressed")).toBe("true");
    expect(editor.getByRole("spinbutton", { name: "Other duration in minutes" })).toHaveProperty("value", "45");
    expect(await saved(editor)).toEqual(expect.objectContaining({ estimatedMinutes: 45 }));
  });
});

describe("Due and Earliest Start", () => {
  it("offer None, Today, Tomorrow and Pick a date", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "Due"));
    expect(within(editor.getByRole("group", { name: "Deadline" })).getAllByRole("button").map((c) => c.textContent))
      .toEqual(["No deadline", "Today", "Tomorrow", "Pick a date"]);

    await userEvent.click(line(editor, "Earliest Start"));
    expect(within(editor.getByRole("group", { name: "Earliest Start" })).getAllByRole("button").map((c) => c.textContent))
      .toEqual(["Any time", "Today", "Tomorrow", "Pick a date"]);
  });

  it("sets Tomorrow and closes, and the time appears once it's opened again", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "Due"));
    expect(editor.queryByLabelText("Deadline time (optional)")).toBeNull();
    await userEvent.click(editor.getByRole("button", { name: "Tomorrow" }));

    expect(editor.queryByRole("button", { name: "Tomorrow" })).toBeNull();
    expect(line(editor, "Due").textContent).toContain("Wed 28 Oct");

    await userEvent.click(line(editor, "Due"));
    expect(editor.getByRole("button", { name: "Tomorrow" }).getAttribute("aria-pressed")).toBe("true");
    expect(editor.getByLabelText("Deadline time (optional)")).toBeTruthy();
  });

  it("stays open under Pick a date once a date is entered, with the time on offer", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "Earliest Start"));
    await userEvent.click(editor.getByRole("button", { name: "Pick a date" }));
    expect(editor.queryByLabelText("Earliest Start time (optional)")).toBeNull();
    await userEvent.type(editor.getByLabelText("Earliest Start date"), "2026-11-06");
    await userEvent.type(editor.getByLabelText("Earliest Start time (optional)"), "09:30");

    expect(line(editor, "Earliest Start").textContent).toContain("Fri 6 Nov, 09:30");
    expect(await saved(editor)).toEqual(
      expect.objectContaining({ earliestStart: { date: "2026-11-06", time: "09:30" } }),
    );
  });

  it("keeps a stored date beyond tomorrow, and its time, on opening and saving", async () => {
    const deadline = { date: "2026-11-06", time: "14:00" };
    renderScreen({ ...task, deadline });
    const editor = await openScreen();

    await userEvent.click(line(editor, "Due"));

    expect(editor.getByRole("button", { name: "Pick a date" }).getAttribute("aria-pressed")).toBe("true");
    expect(editor.getByLabelText("Deadline date")).toHaveProperty("value", "2026-11-06");
    expect(editor.getByLabelText("Deadline time (optional)")).toHaveProperty("value", "14:00");
    expect(await saved(editor)).toEqual(expect.objectContaining({ deadline }));
  });

  it("No deadline clears the date and closes", async () => {
    renderScreen({ ...task, deadline: { date: "2026-10-28", time: null } });
    const editor = await openScreen();

    await userEvent.click(line(editor, "Due"));
    await userEvent.click(editor.getByRole("button", { name: "No deadline" }));

    expect(line(editor, "Due").textContent).toContain("No deadline");
    expect(editor.queryByRole("button", { name: "Today" })).toBeNull();
    expect(await saved(editor)).toEqual(expect.objectContaining({ deadline: null }));
  });
});

describe("a closed line keeps its choice", () => {
  it("sends every field to the save, whichever lines were opened", async () => {
    const stored = {
      ...task,
      notes: "See the board pack",
      estimatedMinutes: 45,
      deadline: { date: "2026-11-06", time: "14:00" },
      earliestStart: { date: "2026-11-02", time: null },
      priority: "low" as const,
      splittable: true,
      contextId: "deep",
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 30,
    };
    renderScreen(stored, { contexts: [workContext, deepWorkContext] });
    const editor = await openScreen();

    await userEvent.click(line(editor, "Priority"));
    await userEvent.click(editor.getByRole("radio", { name: "High" }));

    expect(await saved(editor)).toEqual({
      title: "Write planning doc",
      notes: "See the board pack",
      estimatedMinutes: 45,
      deadline: { date: "2026-11-06", time: "14:00" },
      earliestStart: { date: "2026-11-02", time: null },
      priority: "high",
      splittable: true,
      contextId: "deep",
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 30,
    });
  });
});

const more = (editor: Screen) => editor.getByRole("button", { name: /^More/ });
const backButton = () => screen.getByRole("button", { name: "← Back to the week" });
const chipsOf = (group: HTMLElement) => within(group).getAllByRole("radio").map((c) => c.textContent);

describe("the More section", () => {
  const declinedTimes = [{ id: 7, start: new Date("2026-10-27T10:00:00Z"), end: new Date("2026-10-27T11:00:00Z") }];

  it("starts closed, holding the rarely used fields, and is closed again each time the Task opens", async () => {
    renderScreen({ ...task, declinedTimes });
    let editor = await openScreen();
    for (const hidden of [
      editor.queryByRole("switch", { name: "Can be split" }),
      editor.queryByRole("radiogroup", { name: "Buffer before" }),
      editor.queryByRole("radiogroup", { name: "Buffer after" }),
      editor.queryByRole("textbox", { name: "Notes" }),
      editor.queryByText("Declined Times"),
      editor.queryByRole("button", { name: "Delete" }),
    ]) {
      expect(hidden).toBeNull();
    }
    expect(more(editor).getAttribute("aria-expanded")).toBe("false");

    await userEvent.click(more(editor));

    expect(more(editor).getAttribute("aria-expanded")).toBe("true");
    expect(editor.getByRole("switch", { name: "Can be split" })).toBeTruthy();
    expect(editor.getByRole("radiogroup", { name: "Buffer before" })).toBeTruthy();
    expect(editor.getByRole("radiogroup", { name: "Buffer after" })).toBeTruthy();
    expect(editor.getByRole("textbox", { name: "Notes" })).toBeTruthy();
    expect(editor.getByText("Declined Times")).toBeTruthy();
    expect(editor.getByRole("button", { name: "Delete" })).toBeTruthy();

    await userEvent.click(backButton());
    editor = await openScreen();
    expect(more(editor).getAttribute("aria-expanded")).toBe("false");
  });

  it("names nothing when nothing inside is set", async () => {
    renderScreen();
    const editor = await openScreen();

    expect(more(editor).textContent).toBe("More");
  });

  it("names what's set inside it", async () => {
    renderScreen({ ...task, notes: "See the board pack" });
    const editor = await openScreen();

    expect(more(editor).textContent).toBe("More · Notes");
  });

  it("names everything that's set, once each", async () => {
    renderScreen({
      ...task,
      notes: "See the board pack",
      splittable: true,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 30,
      declinedTimes,
    });
    const editor = await openScreen();

    expect(more(editor).textContent).toBe("More · Notes, Can be split, Buffer, Declined Times");
  });

  it("counts a Buffer of 0 as the Task's own", async () => {
    renderScreen({ ...task, bufferBeforeMinutes: 0 });
    const editor = await openScreen();

    expect(more(editor).textContent).toBe("More · Buffer");
  });

  it("keeps what was typed when it closes, and says so", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(more(editor));
    await userEvent.type(editor.getByRole("textbox", { name: "Notes" }), "Ask Sam");
    await userEvent.click(more(editor));

    expect(more(editor).textContent).toBe("More · Notes");
    expect(await saved(editor)).toEqual(expect.objectContaining({ notes: "Ask Sam" }));
  });

  it("closes an open line, as only one thing is open at a time", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "Priority"));
    await userEvent.click(more(editor));

    expect(editor.queryByRole("radio", { name: "Critical" })).toBeNull();
    expect(editor.getByRole("textbox", { name: "Notes" })).toBeTruthy();
  });

  it("reads “Can be split” once, with no Splitting label", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(more(editor));

    expect(editor.getByRole("switch", { name: "Can be split" })).toBeTruthy();
    expect(editor.queryByText("Splitting")).toBeNull();
  });

  it("doesn't show Declined Times when the Task has none", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(more(editor));

    expect(editor.queryByText("Declined Times")).toBeNull();
    expect(editor.queryByText("None")).toBeNull();
  });
});

describe("a Task's Buffers", () => {
  // The defaults are 0 before and 15m after.
  it("don't offer the length equal to the default", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(more(editor));

    expect(chipsOf(editor.getByRole("radiogroup", { name: "Buffer before" })))
      .toEqual(["Default (none)", "15m", "30m", "45m", "1h"]);
    expect(chipsOf(editor.getByRole("radiogroup", { name: "Buffer after" })))
      .toEqual(["Default (15m)", "0", "30m", "45m", "1h"]);
  });

  it("keep showing a Task's own Buffer equal to the default, even once Default is tapped", async () => {
    renderScreen({ ...task, bufferAfterMinutes: 15 });
    const editor = await openScreen();

    await userEvent.click(more(editor));
    const after = within(editor.getByRole("radiogroup", { name: "Buffer after" }));

    expect(after.getByRole("radio", { name: "15m" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(after.getByRole("radio", { name: "Default (15m)" }));
    expect(after.getByRole("radio", { name: "15m" }).getAttribute("aria-checked")).toBe("false");
    await userEvent.click(after.getByRole("radio", { name: "15m" }));
    expect(after.getByRole("radio", { name: "15m" }).getAttribute("aria-checked")).toBe("true");

    expect(await saved(editor)).toEqual(expect.objectContaining({ bufferAfterMinutes: 15 }));
  });

  it("keep following the default, rather than saving its length", async () => {
    renderScreen();
    const editor = await openScreen();

    expect(await saved(editor)).toEqual(expect.objectContaining({ bufferBeforeMinutes: null, bufferAfterMinutes: null }));
  });
});

describe("leaving the Task screen", () => {
  it("has no Cancel", async () => {
    renderScreen();
    const editor = await openScreen();

    expect(editor.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("leaves straight away when nothing has changed", async () => {
    renderScreen();
    const editor = await openScreen();

    await userEvent.click(line(editor, "Priority"));
    await userEvent.click(backButton());

    expect(screen.queryByRole("form", { name: "Edit Task" })).toBeNull();
    expect(screen.getByText("Calendar")).toBeTruthy();
  });

  it("asks in place when something has changed, and Keep editing keeps it", async () => {
    renderScreen();
    const editor = await openScreen();
    await userEvent.click(line(editor, "Priority"));
    await userEvent.click(editor.getByRole("radio", { name: "Critical" }));

    await userEvent.click(backButton());

    expect(screen.queryByRole("button", { name: "← Back to the week" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("form", { name: "Edit Task" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull();
    expect(line(editor, "Priority").textContent).toContain("Critical");
    expect(backButton()).toBeTruthy();
  });

  it("Discard changes leaves without saving, and the Task opens as it was", async () => {
    renderScreen();
    let editor = await openScreen();
    await userEvent.click(line(editor, "Priority"));
    await userEvent.click(editor.getByRole("radio", { name: "Critical" }));

    await userEvent.click(backButton());
    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(screen.getByText("Calendar")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Edit Task" })).toBeNull();
    expect(updateTask).not.toHaveBeenCalled();
    editor = await openScreen();
    expect(line(editor, "Priority").textContent).toContain("Medium");
  });

  it("asks nothing when a change was undone by hand", async () => {
    renderScreen();
    const editor = await openScreen();
    await userEvent.click(line(editor, "Priority"));
    await userEvent.click(editor.getByRole("radio", { name: "Critical" }));
    await userEvent.click(line(editor, "Priority"));
    await userEvent.click(editor.getByRole("radio", { name: "Medium" }));

    await userEvent.click(backButton());

    expect(screen.queryByRole("form", { name: "Edit Task" })).toBeNull();
  });
});

describe("a problem with a value", () => {
  it("opens the line holding it", async () => {
    renderScreen();
    const editor = await openScreen();
    await userEvent.click(line(editor, "How long"));
    await userEvent.click(editor.getByRole("button", { name: "Other" }));
    await userEvent.type(editor.getByRole("spinbutton", { name: "Other duration in minutes" }), "20");
    await userEvent.click(line(editor, "How long"));

    await userEvent.click(editor.getByRole("button", { name: "Save" }));

    expect(line(editor, "How long").getAttribute("aria-expanded")).toBe("true");
    expect(editor.getByText(/15-minute steps/)).toBeTruthy();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("opens the line of the first problem, and says “Not set” rather than a broken length", async () => {
    renderScreen({ ...task, earliestStart: { date: "2026-11-06", time: null }, deadline: { date: "2026-11-02", time: null } });
    const editor = await openScreen();
    await userEvent.click(line(editor, "How long"));
    await userEvent.click(editor.getByRole("button", { name: "Other" }));
    const other = editor.getByRole("spinbutton", { name: "Other duration in minutes" });
    await userEvent.type(other, "45");
    await userEvent.clear(other);
    await userEvent.click(line(editor, "Priority"));

    expect(line(editor, "How long").textContent).toContain("Not set");
    await userEvent.click(editor.getByRole("button", { name: "Save" }));

    expect(line(editor, "How long").getAttribute("aria-expanded")).toBe("true");
    expect(line(editor, "Earliest Start").getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the Earliest Start line for a start after the deadline", async () => {
    renderScreen({ ...task, earliestStart: { date: "2026-11-06", time: null }, deadline: { date: "2026-11-02", time: null } });
    const editor = await openScreen();

    await userEvent.click(editor.getByRole("button", { name: "Save" }));

    expect(line(editor, "Earliest Start").getAttribute("aria-expanded")).toBe("true");
    expect(editor.getByText(/is after the deadline/)).toBeTruthy();
  });

  it("opens More when that's where it is", async () => {
    renderScreen({ ...task, bufferAfterMinutes: 7 });
    const editor = await openScreen();

    await userEvent.click(editor.getByRole("button", { name: "Save" }));

    expect(more(editor).getAttribute("aria-expanded")).toBe("true");
    expect(editor.getByText(/After must be 0, 15, 30, 45 or 60 minutes/)).toBeTruthy();
  });

  it("shows a missing title under the title, which is always in view", async () => {
    renderScreen();
    const editor = await openScreen();
    await userEvent.clear(editor.getByRole("textbox", { name: "Title" }));

    await userEvent.click(editor.getByRole("button", { name: "Save" }));

    expect(editor.getByText("Give the Task a title.")).toBeTruthy();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("goes once the value is changed", async () => {
    renderScreen({ ...task, earliestStart: { date: "2026-11-06", time: null }, deadline: { date: "2026-11-02", time: null } });
    const editor = await openScreen();
    await userEvent.click(editor.getByRole("button", { name: "Save" }));

    await userEvent.click(editor.getByRole("button", { name: "Any time" }));

    expect(editor.queryByText(/is after the deadline/)).toBeNull();
  });
});

describe("offline", () => {
  afterEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: true }));

  it("lets lines and More open to be read, with Save disabled and saying why", async () => {
    renderScreen({ ...task, notes: "See the board pack" });
    const editor = await openScreen();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event("offline")));

    await userEvent.click(line(editor, "Priority"));
    expect(editor.getByRole("radio", { name: "Critical" })).toBeTruthy();
    await userEvent.click(more(editor));
    expect(editor.getByRole("textbox", { name: "Notes" })).toHaveProperty("value", "See the board pack");

    expect(editor.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
    expect(editor.getByText("Offline: this needs a connection.")).toBeTruthy();
    expect(editor.getByRole("button", { name: "Delete" })).toHaveProperty("disabled", true);
  });
});

describe("a new Task", () => {
  async function openFullForm(text: string) {
    await userEvent.type(screen.getByRole("textbox", { name: /add a task/i }), text);
    await userEvent.click(screen.getByRole("button", { name: "Full form" }));
    return within(screen.getByRole("form", { name: "New Task" }));
  }

  function renderEmpty() {
    return renderGuarded(
      <WithTaskList tasks={[]} today={TODAY}>
        <TaskPanel />
        <TaskEditorSlot><div>Calendar</div></TaskEditorSlot>
      </WithTaskList>,
    );
  }

  it("uses the same lines, carrying what the one-line add understood, with Add Task for Save", async () => {
    renderEmpty();
    const editor = await openFullForm("Pack for Vegas 2h");

    expect(editor.getByRole("textbox", { name: "Title" })).toHaveProperty("value", "Pack for Vegas");
    expect(line(editor, "How long").textContent).toContain("2h");
    expect(more(editor).getAttribute("aria-expanded")).toBe("false");
    expect(editor.getByRole("button", { name: "Add Task" })).toBeTruthy();
    expect(editor.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("has no Delete in More", async () => {
    renderEmpty();
    const editor = await openFullForm("Pack for Vegas 2h");

    await userEvent.click(more(editor));

    expect(editor.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("leaves straight away when only following the default was tapped", async () => {
    renderEmpty();
    const editor = await openFullForm("Pack for Vegas 2h");
    await userEvent.click(more(editor));
    await userEvent.click(within(editor.getByRole("radiogroup", { name: "Buffer after" })).getByRole("radio", { name: "Default (15m)" }));

    await userEvent.click(backButton());

    expect(screen.queryByRole("form", { name: "New Task" })).toBeNull();
    expect(screen.getByRole("textbox", { name: /add a task/i })).toHaveProperty("value", "Pack for Vegas 2h");
  });
});

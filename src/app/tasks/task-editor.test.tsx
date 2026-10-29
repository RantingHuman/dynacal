// @vitest-environment jsdom

import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { taskItem, deferred } from "../testing/fixtures";
import { renderGuarded } from "../testing/render";
import { clearDeclinedTime, deleteTask, updateTask } from "./actions";
import { TaskEditorProvider, TaskEditorSlot } from "./task-editor-slot";
import { TaskPanel } from "./task-panel";

vi.mock("./actions", () => ({
  createTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(), completeTask: vi.fn(), clearDeclinedTime: vi.fn(),
}));

const task = taskItem({ id: "task-1", title: "Write planning doc" });

function renderPage(item = task) {
  return renderGuarded(
    <TaskEditorProvider>
      <TaskPanel tasks={[item]} flags={{}} timeZone="Europe/London" />
      <TaskEditorSlot><div>Calendar</div></TaskEditorSlot>
    </TaskEditorProvider>,
  );
}

async function openEditor() {
  await userEvent.click(screen.getByRole("button", { name: /^Write planning doc/ }));
  return within(screen.getByRole("form", { name: "Edit Task" }));
}

describe("the full-page Task editor", () => {
  beforeEach(() => {
    vi.mocked(updateTask).mockReset();
    vi.mocked(deleteTask).mockReset();
    vi.mocked(clearDeclinedTime).mockReset();
  });
  afterEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: true }));

  it("saves a changed title and returns to the week", async () => {
    const saving = deferred<Awaited<ReturnType<typeof updateTask>>>();
    vi.mocked(updateTask).mockReturnValue(saving.promise);
    const page = renderPage();
    const editor = await openEditor();
    const title = editor.getByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.type(title, "Write the annual plan");
    await userEvent.click(editor.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Calendar")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Write the annual plan/ })).toBeTruthy();
    expect(updateTask).toHaveBeenCalledWith("task-1", expect.objectContaining({ title: "Write the annual plan" }));
    page.rerender(
      <TaskEditorProvider>
        <TaskPanel tasks={[{ ...task, title: "Write the annual plan" }]} flags={{}} timeZone="Europe/London" />
        <TaskEditorSlot><div>Calendar</div></TaskEditorSlot>
      </TaskEditorProvider>,
    );
    saving.resolve({ ok: true, task: { ...task, title: "Write the annual plan" } });
    await waitFor(() => expect(updateTask).toHaveReturned());
    expect(await screen.findByRole("button", { name: /^Write the annual plan/ })).toBeTruthy();
  });

  it("shows whether the Task can be split, and saves the change", async () => {
    const changed = taskItem({ id: "task-1", title: "Write planning doc", splittable: true });
    vi.mocked(updateTask).mockResolvedValue({ ok: true, task: { ...changed, splittable: false } });
    renderPage(changed);
    const editor = await openEditor();
    const canSplit = editor.getByRole("switch", { name: "Can be split" });
    expect(canSplit.getAttribute("aria-checked")).toBe("true");

    await userEvent.click(canSplit);
    expect(canSplit.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(editor.getByRole("button", { name: "Save" }));

    expect(updateTask).toHaveBeenCalledWith("task-1", expect.objectContaining({ splittable: false }));
    await waitFor(() => expect(updateTask).toHaveReturned());
  });

  it("rolls back the edit and explains a server refusal", async () => {
    vi.mocked(updateTask).mockResolvedValue({ ok: false, errors: { title: "That title is too long." } });
    renderPage();
    const editor = await openEditor();
    const title = editor.getByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.type(title, "Annual plan");
    await userEvent.click(editor.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("“Annual plan” wasn't saved: That title is too long.")).toBeTruthy();
    expect(await screen.findByRole("button", { name: /^Write planning doc/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Annual plan/ })).toBeNull();
  });

  it("cancels changes without saving", async () => {
    renderPage();
    const editor = await openEditor();
    await userEvent.clear(editor.getByRole("textbox", { name: "Title" }));
    await userEvent.type(editor.getByRole("textbox", { name: "Title" }), "Annual plan");
    await userEvent.click(editor.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Calendar")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Write planning doc/ })).toBeTruthy();
    expect(updateTask).not.toHaveBeenCalled();
    expect((await openEditor()).getByRole("textbox", { name: "Title" })).toHaveProperty("value", "Write planning doc");
  });

  it("asks before deletion, lets the owner keep the Task, and deletes only on confirmation", async () => {
    vi.mocked(deleteTask).mockResolvedValue(undefined);
    const page = renderPage();
    const editor = await openEditor();
    await userEvent.click(editor.getByRole("button", { name: "Delete" }));
    expect(editor.getByText("Delete it?")).toBeTruthy();
    await userEvent.click(editor.getByRole("button", { name: "Keep" }));
    expect(deleteTask).not.toHaveBeenCalled();
    expect(editor.queryByText("Delete it?")).toBeNull();
    await userEvent.click(editor.getByRole("button", { name: "Delete" }));
    await userEvent.click(within(editor.getByRole("group", { name: "Confirm delete" })).getByRole("button", { name: "Delete" }));
    expect(deleteTask).toHaveBeenCalledWith("task-1");
    await waitFor(() => expect(screen.queryByRole("form", { name: "Edit Task" })).toBeNull());
    page.rerender(
      <TaskEditorProvider>
        <TaskPanel tasks={[]} flags={{}} timeZone="Europe/London" />
        <TaskEditorSlot><div>Calendar</div></TaskEditorSlot>
      </TaskEditorProvider>,
    );
    expect(screen.queryByRole("button", { name: /^Write planning doc/ })).toBeNull();
    expect(screen.getByText("Calendar")).toBeTruthy();
  });

  it("clears a Declined Time", async () => {
    vi.mocked(clearDeclinedTime).mockResolvedValue({ ok: true });
    renderPage({ ...task, declinedTimes: [{ id: 7, start: new Date("2026-10-27T10:00:00Z"), end: new Date("2026-10-27T11:00:00Z") }] });
    const editor = await openEditor();
    expect(editor.getByText("Declined Times")).toBeTruthy();
    await userEvent.click(editor.getByRole("button", { name: /Clear the Declined Time.*for “Write planning doc”/ }));
    expect(clearDeclinedTime).toHaveBeenCalledWith(7);
  });

  it("disables changes if the connection drops while deletion is being confirmed", async () => {
    renderPage({ ...task, declinedTimes: [{ id: 7, start: new Date("2026-10-27T10:00:00Z"), end: new Date("2026-10-27T11:00:00Z") }] });
    const editor = await openEditor();
    await userEvent.click(editor.getByRole("button", { name: "Delete" }));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event("offline")));

    expect(editor.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
    expect(within(editor.getByRole("group", { name: "Confirm delete" })).getByRole("button", { name: "Delete" })).toHaveProperty("disabled", true);
    expect(editor.getByRole("button", { name: /Clear the Declined Time/ })).toHaveProperty("disabled", true);
    expect(editor.getByRole("button", { name: "Keep" })).toHaveProperty("disabled", false);
    await userEvent.click(editor.getByRole("button", { name: "Keep" }));
    expect(editor.getByRole("button", { name: "Delete" })).toHaveProperty("disabled", true);
    await userEvent.click(editor.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Calendar")).toBeTruthy();
    expect(deleteTask).not.toHaveBeenCalled();
    expect(clearDeclinedTime).not.toHaveBeenCalled();
  });
});

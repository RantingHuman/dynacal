// @vitest-environment jsdom

import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WithTaskList } from "../testing/with-task-list";
import { completeTask } from "../tasks/actions";
import { renderGuarded } from "../testing/render";
import { moveBlock, setBusyOverride, unpinBlock } from "./actions";
import { BlockEditor } from "./block-editor";
import type { CalendarBlock, CalendarEvent } from "./calendar";
import { EventDetails } from "./event-details";

vi.mock("./actions", () => ({ moveBlock: vi.fn(), unpinBlock: vi.fn(), setBusyOverride: vi.fn() }));
vi.mock("../tasks/actions", () => ({ completeTask: vi.fn() }));

const block: CalendarBlock = {
  id: "block-1", displayKey: "t1#1", taskId: "t1", taskTitle: "Write Q4 planning doc",
  start: "2026-10-27T10:00:00.000Z", end: "2026-10-27T12:00:00.000Z", pinned: false,
};
const event: CalendarEvent = {
  id: "event-1", ref: { calendarId: "work", eventId: "event-1" }, title: "Lunch with Sam",
  calendarName: "Work", allDay: false, start: "2026-10-27T13:00:00.000Z", end: "2026-10-27T14:00:00.000Z",
  free: false, countsAsBusy: true, busyOverride: null, dynacalEvent: null,
};

function renderBlock(overrides: Partial<CalendarBlock> = {}) {
  const onClose = vi.fn();
  renderGuarded(<WithTaskList><BlockEditor block={{ ...block, ...overrides }} timeZone="Europe/London" conflicts={[]} onClose={onClose} /></WithTaskList>);
  return onClose;
}

function renderEvent(overrides: Partial<CalendarEvent> = {}) {
  const onClose = vi.fn();
  renderGuarded(<EventDetails event={{ ...event, ...overrides }} timeZone="Europe/London" onClose={onClose} />);
  return onClose;
}

beforeEach(() => {
  vi.mocked(moveBlock).mockReset();
  vi.mocked(unpinBlock).mockReset();
  vi.mocked(setBusyOverride).mockReset();
  vi.mocked(completeTask).mockReset();
});
afterEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: true }));

describe("desktop Block label", () => {
  it("saves a selected date and times, then closes", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: true });
    const close = renderBlock();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-29" } });
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "14:30" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "16:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Save and pin" }));
    await waitFor(() => expect(moveBlock).toHaveBeenCalledWith("block-1", { start: "2026-10-29T14:30:00.000Z", end: "2026-10-29T16:00:00.000Z" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("shows a refused move and stays open", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: false, errors: { block: "That would overlap Lunch with Sam." } });
    const close = renderBlock();
    await userEvent.click(screen.getByRole("button", { name: "Save and pin" }));
    expect((await screen.findByRole("alert")).textContent).toBe("That would overlap Lunch with Sam.");
    expect(close).not.toHaveBeenCalled();
  });

  it("unpins a Pinned Block and closes", async () => {
    vi.mocked(unpinBlock).mockResolvedValue({ ok: true });
    const close = renderBlock({ pinned: true });
    await userEvent.click(screen.getByRole("button", { name: "Unpin" }));
    expect(unpinBlock).toHaveBeenCalledWith("block-1");
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("keeps the label open if Unpin is refused", async () => {
    vi.mocked(unpinBlock).mockResolvedValue({ ok: false, notFound: true });
    const close = renderBlock({ pinned: true });
    await userEvent.click(screen.getByRole("button", { name: "Unpin" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't unpin “Write Q4 planning doc”: its time changed elsewhere.");
    expect(close).not.toHaveBeenCalled();
  });

  it("marks the whole Task done and closes", async () => {
    vi.mocked(completeTask).mockResolvedValue({ ok: true });
    const close = renderBlock();
    await userEvent.click(screen.getByRole("button", { name: "✓ Mark the Task done" }));
    expect(completeTask).toHaveBeenCalledWith("t1");
    expect(close).toHaveBeenCalledOnce();
  });

  it("disables changes offline but can still close", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    renderBlock({ pinned: true });
    for (const name of ["Save", "Unpin", "✓ Mark the Task done"]) expect(screen.getByRole("button", { name })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Close" })).toHaveProperty("disabled", false);
  });
});

describe("desktop Event label", () => {
  it("sets an Event not to count as busy", async () => {
    vi.mocked(setBusyOverride).mockResolvedValue({ ok: true });
    renderEvent();
    await userEvent.click(screen.getByRole("button", { name: "Doesn’t count" }));
    await waitFor(() => expect(setBusyOverride).toHaveBeenCalledWith(event.ref, "not-busy"));
  });

  it("changes Busy Override and can return to the setting", async () => {
    vi.mocked(setBusyOverride).mockResolvedValue({ ok: true });
    renderEvent({ busyOverride: "busy" });
    expect(screen.getByRole("button", { name: "Counts as busy" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Follow settings" }));
    await waitFor(() => expect(setBusyOverride).toHaveBeenCalledWith(event.ref, null));
  });

  it("reports an Event that no longer exists", async () => {
    vi.mocked(setBusyOverride).mockResolvedValue({ ok: false, notFound: true });
    const close = renderEvent();
    await userEvent.click(screen.getByRole("button", { name: "Doesn’t count" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This Event no longer exists in your calendar.");
    expect(close).not.toHaveBeenCalled();
  });

  it("disables Busy Override offline", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    renderEvent();
    for (const name of ["Follow settings", "Counts as busy", "Doesn’t count"]) expect(screen.getByRole("button", { name }).matches(":disabled")).toBe(true);
  });

  it("closes on Escape", async () => {
    const close = renderEvent();
    await userEvent.keyboard("{Escape}");
    expect(close).toHaveBeenCalledOnce();
  });
});

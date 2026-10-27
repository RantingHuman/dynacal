// @vitest-environment jsdom

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveBlock, unpinBlock } from "../../schedule/actions";
import type { CalendarBlock } from "../../schedule/calendar";
import { completeTask } from "../../tasks/actions";
import { TaskEditorProvider } from "../../tasks/task-editor-slot";
import { renderGuarded } from "../../testing/render";
import { BlockSheet } from "./block-sheet";

vi.mock("../../schedule/actions", () => ({ moveBlock: vi.fn(), unpinBlock: vi.fn() }));
vi.mock("../../tasks/actions", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn(),
  clearDeclinedTime: vi.fn(),
}));

// A Block on Tuesday 27 October 2026, 10:00–12:00 London time (GMT, after the clocks went back).
const block: CalendarBlock = {
  id: "block-1",
  displayKey: "t1#1",
  taskId: "t1",
  taskTitle: "Write Q4 planning doc",
  start: "2026-10-27T10:00:00.000Z",
  end: "2026-10-27T12:00:00.000Z",
  pinned: false,
};

function renderSheet(onClose = vi.fn(), overrides: Partial<CalendarBlock> = {}) {
  renderGuarded(
    <TaskEditorProvider>
      <BlockSheet block={{ ...block, ...overrides }} timeZone="Europe/London" conflicts={[]} onClose={onClose} />
    </TaskEditorProvider>,
  );
  return onClose;
}

describe("the Block sheet on a phone", () => {
  beforeEach(() => {
    vi.mocked(moveBlock).mockReset();
    vi.mocked(unpinBlock).mockReset();
    vi.mocked(completeTask).mockReset();
  });

  it("moves the Block by a chip, keeping its length", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: true });
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "+15m" }));

    await waitFor(() =>
      expect(moveBlock).toHaveBeenCalledWith("block-1", {
        start: "2026-10-27T10:15:00.000Z",
        end: "2026-10-27T12:15:00.000Z",
      }),
    );
  });

  it("moves the Block to the next day at the same time", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: true });
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "Next day" }));

    await waitFor(() =>
      expect(moveBlock).toHaveBeenCalledWith("block-1", {
        start: "2026-10-28T10:00:00.000Z",
        end: "2026-10-28T12:00:00.000Z",
      }),
    );
  });

  it("moves the Block to an exact day and start, keeping its length, then closes the picker", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: true });
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "Pick a time…" }));
    // The picker starts on the Block's own day and start.
    expect(screen.getByLabelText("Day")).toHaveProperty("value", "2026-10-27");
    expect(screen.getByLabelText("Start")).toHaveProperty("value", "10:00");
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "2026-10-29" } });
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "14:30" } });
    await userEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() =>
      expect(moveBlock).toHaveBeenCalledWith("block-1", {
        start: "2026-10-29T14:30:00.000Z",
        end: "2026-10-29T16:30:00.000Z",
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Pick a time…" })).toBeTruthy());
  });

  it("leaves the Block where it was and says why when the move is refused", async () => {
    vi.mocked(moveBlock).mockResolvedValue({ ok: false, errors: { block: "That would overlap Lunch with Sam." } });
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "−30m" }));

    await waitFor(() => expect(screen.getByText("That would overlap Lunch with Sam.")).toBeTruthy());
  });

  it("offers Unpin only for a Pinned Block", () => {
    renderSheet();
    expect(screen.queryByRole("button", { name: "Unpin" })).toBeNull();
  });

  it("unpins a Pinned Block and closes", async () => {
    vi.mocked(unpinBlock).mockResolvedValue({ ok: true });
    const onClose = renderSheet(vi.fn(), { pinned: true });

    await userEvent.click(screen.getByRole("button", { name: "Unpin" }));

    expect(unpinBlock).toHaveBeenCalledWith("block-1");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("stays open and says why when unpinning is refused", async () => {
    vi.mocked(unpinBlock).mockResolvedValue({ ok: false, notFound: true });
    const onClose = renderSheet(vi.fn(), { pinned: true });

    await userEvent.click(screen.getByRole("button", { name: "Unpin" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("This Block no longer exists."));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("marks the Block's Task done and closes", async () => {
    vi.mocked(completeTask).mockResolvedValue({ ok: true });
    const onClose = renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "✓ Mark the Task done" }));

    expect(completeTask).toHaveBeenCalledWith("t1");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  describe("offline", () => {
    beforeEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: false }));
    afterEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: true }));

    it("disables every control that would change the Block", () => {
      renderSheet(vi.fn(), { pinned: true });

      for (const name of ["−30m", "−15m", "+15m", "+30m", "Next day", "Pick a time…", "✓ Mark the Task done", "Unpin"]) {
        expect(screen.getByRole("button", { name })).toHaveProperty("disabled", true);
      }
      // Close only closes the sheet, so it still works.
      expect(screen.getByRole("button", { name: "Close" })).toHaveProperty("disabled", false);
    });

    it("disables Move in an open picker when the connection drops", async () => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      renderSheet();
      await userEvent.click(screen.getByRole("button", { name: "Pick a time…" }));
      expect(screen.getByRole("button", { name: "Move" })).toHaveProperty("disabled", false);

      Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(screen.getByRole("button", { name: "Move" })).toHaveProperty("disabled", true);
    });
  });
});

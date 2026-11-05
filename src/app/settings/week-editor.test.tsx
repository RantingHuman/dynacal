// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DEFAULT_WINDOWS, type WeeklyWindows } from "@/core/settings";
import { WeekEditor } from "./week-editor";

const hours = (start: number, end: number) => [{ start: start * 60, end: end * 60 }];
const off: WeeklyWindows = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

/** The editor with its week kept in state, the way Settings keeps it; `latest` reads the week it last sent. */
function renderEditor(initial: WeeklyWindows = DEFAULT_WINDOWS) {
  let latest = initial;
  let reset: (week: WeeklyWindows) => void = () => {};
  function Host() {
    const [week, setWeek] = useState(initial);
    reset = setWeek;
    return (
      <WeekEditor
        windows={week}
        onChange={(next) => {
          latest = next;
          setWeek(next);
        }}
      />
    );
  }
  render(<Host />);
  return { latest: () => latest, reset: (week: WeeklyWindows) => reset(week) };
}

const day = (name: string) => screen.getByRole("button", { name });
const handleOf = (name: "Start" | "End", bar = 1) =>
  within(screen.getByRole("group", { name: `Hours ${bar}` })).getByRole("slider", { name }).parentElement!;

describe("the week editor", () => {
  it("starts on the week's days, pressed, and its hours", () => {
    renderEditor();
    for (const name of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
      expect(day(name).getAttribute("aria-pressed")).toBe("true");
    }
    expect(day("Saturday").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("slider", { name: "Start" }).getAttribute("aria-valuetext")).toBe("09:00");
    expect(screen.getByRole("slider", { name: "End" }).getAttribute("aria-valuetext")).toBe("17:00");
  });

  it("drags the end of the bar to 11:30, snapping to 15 minutes", () => {
    const editor = renderEditor();
    const end = handleOf("End");

    fireEvent.pointerDown(end, { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(end, { clientY: 500 - 5.5 * 20 + 2, pointerId: 1 }); // 2px short of 11:30 still snaps there
    fireEvent.pointerUp(end, { pointerId: 1 });

    expect(editor.latest()).toEqual({ ...off, mon: hours(9, 11.5), tue: hours(9, 11.5), wed: hours(9, 11.5), thu: hours(9, 11.5), fri: hours(9, 11.5) });
  });

  it("sets Mon, Wed and Fri 07:00–08:00 with the day buttons and the handles' arrow keys", async () => {
    const editor = renderEditor();
    await userEvent.click(day("Tuesday"));
    await userEvent.click(day("Thursday"));
    screen.getByRole("slider", { name: "Start" }).focus();
    await userEvent.keyboard("{ArrowUp>8/}");
    screen.getByRole("slider", { name: "End" }).focus();
    await userEvent.keyboard("{ArrowUp>36/}");

    expect(editor.latest()).toEqual({ ...off, mon: hours(7, 8), wed: hours(7, 8), fri: hours(7, 8) });
  });

  it("nudges an end by 15 minutes with − and +, never past the other end", async () => {
    const editor = renderEditor({ ...off, mon: hours(9, 9.5) });
    await userEvent.click(screen.getByRole("button", { name: "End 15 minutes later" }));
    expect(editor.latest().mon).toEqual([{ start: 540, end: 585 }]);

    for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole("button", { name: "End 15 minutes earlier" }));
    expect(editor.latest().mon).toEqual([{ start: 540, end: 555 }]);
  });

  it("adds a second stretch of hours on the same days, and removes it", async () => {
    const editor = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "+ more hours" }));
    expect(editor.latest().wed).toEqual([...hours(9, 17), ...hours(18, 20)]);

    await userEvent.click(screen.getByRole("button", { name: "Remove 18:00–20:00" }));
    expect(editor.latest().wed).toEqual(hours(9, 17));
  });

  it("gives the remaining days different hours, showing the first set as a line to come back to", async () => {
    const editor = renderEditor();
    await userEvent.click(screen.getByRole("button", { name: "Different hours on some days" }));

    expect(editor.latest()).toEqual({ ...DEFAULT_WINDOWS, sat: hours(10, 14), sun: hours(10, 14) });
    expect(day("Saturday").getAttribute("aria-pressed")).toBe("true");
    const first = screen.getByRole("button", { name: /^Monday to Friday, 09:00–17:00/ });

    // Taking Friday into the weekend's hours takes it from the weekdays'.
    await userEvent.click(day("Friday"));
    expect(editor.latest().fri).toEqual(hours(10, 14));
    expect(editor.latest().thu).toEqual(hours(9, 17));

    await userEvent.click(first);
    expect(day("Monday").getAttribute("aria-pressed")).toBe("true");
    expect(day("Friday").getAttribute("aria-pressed")).toBe("false");
  });

  it("starts again from a week put back from outside, such as Undo", () => {
    const editor = renderEditor();
    fireEvent.click(day("Monday"));
    editor.reset(DEFAULT_WINDOWS);
    return screen.findByRole("button", { name: "Monday", pressed: true });
  });
});

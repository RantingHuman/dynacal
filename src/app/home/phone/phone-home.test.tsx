// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { checkInHref } from "@/core/headline";
import { TaskEditorProvider } from "../../tasks/task-editor-slot";
import { TaskPanel } from "../../tasks/task-panel";
import { taskItem } from "../../testing/fixtures";
import { renderGuarded } from "../../testing/render";
import { PhoneHome } from "./phone-home";

vi.mock("../../tasks/actions", () => ({ checkIn: vi.fn(), allowSplitting: vi.fn() }));

function renderPhone(lead = <h1>Ten Tasks, everything fits.</h1>, tasks = <input aria-label="Add a Task" />) {
  renderGuarded(
    <TaskEditorProvider>
      <PhoneHome
        masthead={<header>dynacal</header>}
        lead={lead}
        tasks={tasks}
        schedule={null}
        today="2026-10-26"
      />
    </TaskEditorProvider>,
  );
}

describe("the home screen on a phone", () => {
  it("opens on the Schedule tab, with the headline and the week", () => {
    renderPhone();

    expect(screen.getByRole("tab", { name: "Schedule" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Ten Tasks, everything fits." })).toBeTruthy();
    expect(screen.getAllByText("Nothing planned")).toHaveLength(7);
    expect(screen.queryByRole("textbox", { name: "Add a Task" })).toBeNull();
  });

  it("switches to Tasks and back, keeping what was typed", async () => {
    renderPhone();

    await userEvent.click(screen.getByRole("tab", { name: "Tasks" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Add a Task" }), "Board memo");
    expect(screen.queryByRole("heading", { name: "Ten Tasks, everything fits." })).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "Schedule" }));
    await userEvent.click(screen.getByRole("tab", { name: "Tasks" }));
    expect(screen.getByRole("textbox", { name: "Add a Task" })).toHaveProperty("value", "Board memo");
  });

  it("switches to Tasks when the headline's Check-in link is tapped, where its sheet opens", async () => {
    renderPhone(<a href={checkInHref("pack")}>Check in</a>);

    await userEvent.click(screen.getByRole("link", { name: "Check in" }));

    expect(screen.getByRole("tab", { name: "Tasks" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Add a Task" })).toBeTruthy();
  });

  it("asks about a past time only as the Task's Check-in: no review box, and never the minutes worked", async () => {
    const waiting = taskItem({
      id: "pack",
      title: "Pack for vegas",
      checkIns: [{ blockId: "b", start: new Date("2026-10-26T10:30:00Z"), end: new Date("2026-10-26T11:30:00Z") }],
    });
    renderPhone(
      <a href={checkInHref("pack")}>Check in</a>,
      <TaskPanel tasks={[waiting]} flags={{}} timeZone="Europe/London" />,
    );

    await userEvent.click(screen.getByRole("link", { name: "Check in" }));

    expect(screen.getByRole("complementary", { name: "Pack for vegas" })).toBeTruthy();
    for (const name of [/done/i, /partly/i, /review/i]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.queryByText(/worked/i)).toBeNull();
  });
});

// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TaskEditorProvider } from "../../tasks/task-editor-slot";
import { renderGuarded } from "../../testing/render";
import { PhoneHome } from "./phone-home";

function renderPhone() {
  renderGuarded(
    <TaskEditorProvider>
      <PhoneHome
        masthead={<header>dynacal</header>}
        lead={<h1>Ten Blocks, everything fits.</h1>}
        review={null}
        tasks={<input aria-label="Add a Task" />}
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
    expect(screen.getByRole("heading", { name: "Ten Blocks, everything fits." })).toBeTruthy();
    expect(screen.getAllByText("Nothing planned")).toHaveLength(7);
    expect(screen.queryByRole("textbox", { name: "Add a Task" })).toBeNull();
  });

  it("switches to Tasks and back, keeping what was typed", async () => {
    renderPhone();

    await userEvent.click(screen.getByRole("tab", { name: "Tasks" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Add a Task" }), "Board memo");
    expect(screen.queryByRole("heading", { name: "Ten Blocks, everything fits." })).toBeNull();

    await userEvent.click(screen.getByRole("tab", { name: "Schedule" }));
    await userEvent.click(screen.getByRole("tab", { name: "Tasks" }));
    expect(screen.getByRole("textbox", { name: "Add a Task" })).toHaveProperty("value", "Board memo");
  });
});

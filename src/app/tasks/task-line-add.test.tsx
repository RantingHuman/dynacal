// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderGuarded } from "../testing/render";
import { TaskLineAdd } from "./task-line-add";

vi.mock("./actions", () => ({ createTask: vi.fn() }));

it("previews what was parsed as the Task line is typed", async () => {
  renderGuarded(<TaskLineAdd today="2026-10-26" offline={false} act={vi.fn()} onFullForm={vi.fn()} />);
  const line = screen.getByRole("textbox", { name: "Add a Task" });
  await userEvent.type(line, "Board memo 2h by fri !high in one go");
  expect(screen.getByText("Board memo")).toBeTruthy();
  expect(screen.getByText("2h")).toBeTruthy();
  expect(screen.getByText("due Fri")).toBeTruthy();
  expect(screen.getByText("High")).toBeTruthy();
  expect(screen.getByText("one Block")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Full form" })).toBeTruthy();
});

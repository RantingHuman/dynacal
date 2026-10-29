// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { renderGuarded } from "../testing/render";
import { TaskLineAdd } from "./task-line-add";

vi.mock("./actions", () => ({ createTask: vi.fn() }));

it("keeps the Task line disabled in server-rendered HTML until it becomes interactive", () => {
  const markup = renderToString(<TaskLineAdd today="2026-10-26" offline={false} act={vi.fn()} onFullForm={vi.fn()} />);
  const document = new DOMParser().parseFromString(markup, "text/html");
  expect(document.querySelector('input[aria-label="Add a Task"]')?.hasAttribute("disabled")).toBe(true);
  const view = renderGuarded(<TaskLineAdd today="2026-10-26" offline={false} act={vi.fn()} onFullForm={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: "Add a Task" })).toHaveProperty("disabled", false);
  view.rerender(<TaskLineAdd today="2026-10-26" offline act={vi.fn()} onFullForm={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: "Add a Task" })).toHaveProperty("disabled", true);
});

it("previews what was parsed as the Task line is typed", async () => {
  renderGuarded(<TaskLineAdd today="2026-10-26" offline={false} act={vi.fn()} onFullForm={vi.fn()} />);
  const line = screen.getByRole("textbox", { name: "Add a Task" });
  await userEvent.type(line, "Board memo 2h by fri !high split");
  expect(screen.getByText("Board memo")).toBeTruthy();
  expect(screen.getByText("2h")).toBeTruthy();
  expect(screen.getByText("due Fri")).toBeTruthy();
  expect(screen.getByText("High")).toBeTruthy();
  expect(screen.getByText("can split")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Full form" })).toBeTruthy();
});

it("keeps an old phrase like “in one go” in the title, and says nothing about splitting", async () => {
  renderGuarded(<TaskLineAdd today="2026-10-26" offline={false} act={vi.fn()} onFullForm={vi.fn()} />);
  await userEvent.type(screen.getByRole("textbox", { name: "Add a Task" }), "Board memo in one go");
  expect(screen.getByText("Board memo in one go")).toBeTruthy();
  expect(screen.queryByText("can split")).toBeNull();
});

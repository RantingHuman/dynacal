// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderGuarded } from "../testing/render";
import { Lead } from "./lead";

it("renders standfirst fixes as links to their destinations", () => {
  renderGuarded(<Lead headline={{ headline: { before: "A ", emphasis: "busy week", after: "." }, standfirst: ["Please ", { text: "set your time zone", href: "/settings" }, ", ", { text: "reconnect Google", href: "/api/google/connect?from=home" }, " and ", { text: "check in", href: "#check-in=task-1" }, "."] }} />);
  expect(screen.getByRole("heading", { name: "A busy week." })).toBeTruthy();
  expect(screen.getByRole("link", { name: "set your time zone" }).getAttribute("href")).toBe("/settings");
  expect(screen.getByRole("link", { name: "reconnect Google" }).getAttribute("href")).toBe("/api/google/connect?from=home");
  expect(screen.getByRole("link", { name: "check in" }).getAttribute("href")).toBe("#check-in=task-1");
});

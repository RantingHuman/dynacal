// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_WINDOWS, type Settings } from "@/core/settings";
import { saveBusyCalendars, saveSetupWeek } from "../settings/actions";
import type { CalendarView } from "../settings/calendar-view";
import { renderGuarded } from "../testing/render";
import { SetupLetter } from "./setup-letter";

vi.mock("../settings/actions", () => ({ saveBusyCalendars: vi.fn(), saveSetupWeek: vi.fn() }));

const settings: Settings = { ...DEFAULT_SETTINGS, timeZone: "Europe/London" };
const status = { googleConnected: false, busyCalendarsChosen: false, timeZoneSaved: false, complete: false };
const connected: CalendarView = { status: "connected", email: "owner@example.com", busyCalendarsChosen: false, calendars: [] };

beforeEach(() => {
  vi.mocked(saveBusyCalendars).mockReset();
  vi.mocked(saveSetupWeek).mockReset();
});

describe("the setup letter", () => {
  it("starts with connecting Google before the later paragraphs can be confirmed", () => {
    renderGuarded(<SetupLetter status={status} calendar={{ status: "not-connected" }} settings={settings} windows={DEFAULT_WINDOWS} />);
    expect(screen.getByRole("link", { name: "Connect Google Calendar" }).getAttribute("href")).toContain("/api/google/connect");
    expect(screen.queryByRole("button", { name: "That’s right" })).toBeNull();
    expect(screen.getByText("09:00–17:00").closest("button")).toHaveProperty("disabled", true);
  });

  it("offers Busy Calendars confirmation after connecting, before the hours", async () => {
    vi.mocked(saveBusyCalendars).mockResolvedValue({ ok: true });
    renderGuarded(<SetupLetter status={{ ...status, googleConnected: true }} calendar={connected} settings={settings} windows={DEFAULT_WINDOWS} />);
    await userEvent.click(screen.getByRole("button", { name: "That’s right" }));
    await waitFor(() => expect(saveBusyCalendars).toHaveBeenCalledWith([]));
    expect(saveSetupWeek).not.toHaveBeenCalled();
    expect(screen.getByText("09:00–17:00").closest("button")).toHaveProperty("disabled", true);
  });

  it("confirms the time zone and hours together, as Work, after Busy Calendars are chosen", async () => {
    vi.mocked(saveSetupWeek).mockResolvedValue({ ok: true });
    renderGuarded(<SetupLetter status={{ ...status, googleConnected: true, busyCalendarsChosen: true }} calendar={connected} settings={settings} windows={DEFAULT_WINDOWS} />);
    await userEvent.click(screen.getByRole("button", { name: "That’s right" }));
    await waitFor(() => expect(saveSetupWeek).toHaveBeenCalledWith({ timeZone: "Europe/London", windows: DEFAULT_WINDOWS }));
  });

  it("prevents confirmation when the hours overlap", async () => {
    renderGuarded(<SetupLetter status={{ ...status, googleConnected: true, busyCalendarsChosen: true }} calendar={connected} settings={settings} windows={DEFAULT_WINDOWS} />);
    await userEvent.click(screen.getByRole("button", { name: "09:00–17:00" }));
    const editor = within(screen.getByRole("group", { name: "Monday to Friday hours" }));
    await userEvent.click(editor.getByRole("button", { name: "+ window" }));
    fireEvent.change(editor.getByLabelText("Monday to Friday window 2 start"), { target: { value: "16:00" } });
    expect(editor.getByRole("alert").textContent).toBe("09:00–17:00 overlaps 16:00–18:00.");
    expect(screen.getByRole("button", { name: "That’s right" })).toHaveProperty("disabled", true);
    expect(saveSetupWeek).not.toHaveBeenCalled();
  });

  it("offers the Schedule when setup is complete", () => {
    renderGuarded(<SetupLetter status={{ googleConnected: true, busyCalendarsChosen: true, timeZoneSaved: true, complete: true }} calendar={connected} settings={settings} windows={DEFAULT_WINDOWS} />);
    expect(screen.getByRole("link", { name: "Go to your Schedule →" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("button", { name: "That’s right" })).toBeNull();
  });
});

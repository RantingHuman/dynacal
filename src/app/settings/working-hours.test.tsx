// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/core/settings";
import { renderGuarded } from "../testing/render";
import { saveSettings } from "./actions";
import { SettingsProse } from "./settings-prose";

vi.mock("./actions", () => ({ saveSettings: vi.fn(), saveBusyCalendars: vi.fn() }));

const initial: Settings = { ...DEFAULT_SETTINGS, timeZone: "Europe/London" };

async function openWeekdays() {
  await userEvent.click(screen.getByRole("button", { name: "09:00–17:00" }));
  return within(screen.getByRole("group", { name: "Monday to Friday hours" }));
}

describe("Working Hours in prose Settings", () => {
  beforeEach(() => {
    vi.mocked(saveSettings).mockReset();
    vi.mocked(saveSettings).mockImplementation(async (settings) => ({ ok: true, settings: settings as Settings }));
    renderGuarded(<SettingsProse initial={initial} calendar={{ status: "unreachable" }} />);
  });

  it("saves an edited run for every weekday", async () => {
    const editor = await openWeekdays();
    fireEvent.change(editor.getByLabelText("Monday to Friday window 1 end"), { target: { value: "16:00" } });
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    const sent = vi.mocked(saveSettings).mock.calls.at(-1)?.[0] as Settings;
    for (const day of ["mon", "tue", "wed", "thu", "fri"] as const) {
      expect(sent.workingHours[day]).toEqual([{ start: 540, end: 960 }]);
    }
    expect(sent.workingHours.sat).toEqual([]);
    expect(sent.workingHours.sun).toEqual([]);
  });

  it("gives Friday its own hours without changing the other weekdays", async () => {
    const editor = await openWeekdays();
    await userEvent.click(editor.getByRole("button", { name: "Fri" }));
    const friday = within(screen.getByRole("group", { name: "Friday hours" }));
    fireEvent.change(friday.getByLabelText("Friday window 1 end"), { target: { value: "15:00" } });
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    const sent = vi.mocked(saveSettings).mock.calls.at(-1)?.[0] as Settings;
    expect(sent.workingHours.fri).toEqual([{ start: 540, end: 900 }]);
    for (const day of ["mon", "tue", "wed", "thu"] as const) {
      expect(sent.workingHours[day]).toEqual([{ start: 540, end: 1020 }]);
    }
    expect(sent.workingHours.sat).toEqual([]);
    expect(sent.workingHours.sun).toEqual([]);
  });

  it("holds overlapping windows unsaved while another setting can save", async () => {
    const editor = await openWeekdays();
    await userEvent.click(editor.getByRole("button", { name: "+ window" }));
    fireEvent.change(editor.getByLabelText("Monday to Friday window 2 start"), { target: { value: "16:00" } });
    expect(editor.getByRole("alert").textContent).toBe("09:00–17:00 overlaps 16:00–18:00.");
    expect(editor.getByRole("button", { name: "Done" })).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByRole("switch", { name: "Count free Events" }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    for (const [sent] of vi.mocked(saveSettings).mock.calls) {
      expect(sent).toMatchObject({ countFreeEvents: true, workingHours: initial.workingHours });
    }
  });
});

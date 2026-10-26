// @vitest-environment jsdom

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/core/settings";
import { renderGuarded } from "../testing/render";
import { saveSettings } from "./actions";
import { SettingsProse } from "./settings-prose";

vi.mock("./actions", () => ({ saveSettings: vi.fn(), saveBusyCalendars: vi.fn() }));

const initial: Settings = { ...DEFAULT_SETTINGS, timeZone: "Europe/London", minimumBlockMinutes: 30 };

function renderSettings() {
  renderGuarded(<SettingsProse initial={initial} calendar={{ status: "unreachable" }} />);
}

/** The editor that opens under the "Never split a Task into Blocks shorter than …" sentence. */
async function openMinimumBlockLength() {
  await userEvent.click(screen.getByRole("button", { name: "30 minutes" }));
  return within(screen.getByRole("group", { name: "Minimum Block Length" }));
}

describe("Settings save as you go", () => {
  beforeEach(() => {
    vi.mocked(saveSettings).mockReset();
    vi.mocked(saveSettings).mockImplementation(async (settings) => ({ ok: true, settings: settings as Settings }));
  });

  it("saves a valid change after a moment, and says so", async () => {
    renderSettings();

    const countFree = screen.getByRole("switch", { name: "Count free Events" });
    expect(countFree.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(countFree);
    expect(countFree.getAttribute("aria-checked")).toBe("true");

    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ countFreeEvents: true })));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Settings saved"));
  });

  it("holds an invalid value unsaved with its message, while other changes still save", async () => {
    renderSettings();
    const editor = await openMinimumBlockLength();

    const field = editor.getByRole("spinbutton", { name: "Minimum Block Length" });
    await userEvent.clear(field);
    await userEvent.type(field, "20");
    await userEvent.click(screen.getByRole("switch", { name: "Count free Events" }));

    expect(editor.getByRole("alert").textContent).toBe("Minimum Block Length must be a multiple of 15 minutes, at least 15.");
    expect(editor.getByRole("button", { name: "Done" })).toHaveProperty("disabled", true);
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    for (const [sent] of vi.mocked(saveSettings).mock.calls) {
      expect(sent).toMatchObject({ countFreeEvents: true, minimumBlockMinutes: 30 });
    }
  });

  it("puts back the last saved value with Undo", async () => {
    renderSettings();
    const editor = await openMinimumBlockLength();
    const field = editor.getByRole("spinbutton", { name: "Minimum Block Length" });
    await userEvent.clear(field);
    await userEvent.type(field, "20");

    await userEvent.click(editor.getByRole("button", { name: "Undo" }));

    expect(field).toHaveProperty("value", "30");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

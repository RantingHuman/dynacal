// @vitest-environment jsdom

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_WINDOWS, type Settings } from "@/core/settings";
import { renderGuarded } from "../testing/render";
import { saveSettings } from "./actions";
import { SettingsProse } from "./settings-prose";

vi.mock("./actions", () => ({ saveSettings: vi.fn(), saveBusyCalendars: vi.fn(), saveContextWindows: vi.fn() }));

const initial: Settings = { ...DEFAULT_SETTINGS, timeZone: "Europe/London", minimumBlockMinutes: 30 };
const work = { id: "work", name: "Work", windows: DEFAULT_WINDOWS, isDefault: true };

function renderSettings() {
  renderGuarded(<SettingsProse initial={initial} contexts={[work]} calendar={{ status: "unreachable" }} />);
}

/** The editor that opens under the "Never split a Task into pieces shorter than …" sentence. */
async function openMinimumBlockLength() {
  await userEvent.click(screen.getByRole("button", { name: "30 minutes" }));
  return within(screen.getByRole("group", { name: "Shortest split piece" }));
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

    const field = editor.getByRole("spinbutton", { name: "Shortest split piece" });
    await userEvent.clear(field);
    await userEvent.type(field, "20");
    await userEvent.click(screen.getByRole("switch", { name: "Count free Events" }));

    expect(editor.getByRole("alert").textContent).toBe("Shortest split piece must be a multiple of 15 minutes, at least 15.");
    expect(editor.getByRole("button", { name: "Done" })).toHaveProperty("disabled", true);
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    for (const [sent] of vi.mocked(saveSettings).mock.calls) {
      expect(sent).toMatchObject({ countFreeEvents: true, minimumBlockMinutes: 30 });
    }
  });

  it("puts back the last saved value with Undo", async () => {
    renderSettings();
    const editor = await openMinimumBlockLength();
    const field = editor.getByRole("spinbutton", { name: "Shortest split piece" });
    await userEvent.clear(field);
    await userEvent.type(field, "20");

    await userEvent.click(editor.getByRole("button", { name: "Undo" }));

    expect(field).toHaveProperty("value", "30");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the Buffer after Tasks", () => {
  beforeEach(() => {
    vi.mocked(saveSettings).mockReset();
    vi.mocked(saveSettings).mockImplementation(async (settings) => ({ ok: true, settings: settings as Settings }));
  });

  it("offers 0, 15m, 30m, 45m and 1h under After Tasks, and saves the one chosen", async () => {
    renderSettings();

    await userEvent.click(screen.getByRole("button", { name: "15 minutes" }));
    const editor = within(screen.getByRole("group", { name: "After Tasks" }));
    expect(editor.getAllByRole("radio").map((c) => c.textContent)).toEqual(["0", "15m", "30m", "45m", "1h"]);
    expect(editor.getByRole("radio", { name: "15m" }).getAttribute("aria-checked")).toBe("true");

    await userEvent.click(editor.getByRole("radio", { name: "45m" }));

    expect(screen.getByRole("button", { name: "45 minutes" })).toBeTruthy();
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ taskBufferAfterMinutes: 45 })));
  });
});

describe("the Event Buffers", () => {
  beforeEach(() => {
    vi.mocked(saveSettings).mockReset();
    vi.mocked(saveSettings).mockImplementation(async (settings) => ({ ok: true, settings: settings as Settings }));
  });

  it("offer the five choices under Before Events, starting at 0, and save the one chosen", async () => {
    renderSettings();

    await userEvent.click(screen.getByRole("button", { name: "no time before" }));
    const editor = within(screen.getByRole("group", { name: "Before Events" }));
    expect(editor.getAllByRole("radio").map((c) => c.textContent)).toEqual(["0", "15m", "30m", "45m", "1h"]);
    expect(editor.getByRole("radio", { name: "0" }).getAttribute("aria-checked")).toBe("true");

    await userEvent.click(editor.getByRole("radio", { name: "15m" }));

    expect(screen.getByRole("button", { name: "15 minutes before" })).toBeTruthy();
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ eventBufferBeforeMinutes: 15 })));
  });

  it("offer the five choices under After Events, and save the one chosen", async () => {
    renderSettings();

    await userEvent.click(screen.getByRole("button", { name: "no time after" }));
    const editor = within(screen.getByRole("group", { name: "After Events" }));
    expect(editor.getAllByRole("radio").map((c) => c.textContent)).toEqual(["0", "15m", "30m", "45m", "1h"]);

    await userEvent.click(editor.getByRole("radio", { name: "1h" }));

    expect(screen.getByRole("button", { name: "1 hour after" })).toBeTruthy();
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ eventBufferAfterMinutes: 60 })));
  });
});

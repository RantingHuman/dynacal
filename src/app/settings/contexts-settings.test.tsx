// @vitest-environment jsdom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@/core/contexts";
import { DEFAULT_SETTINGS, DEFAULT_WINDOWS, type Settings, type WeeklyWindows } from "@/core/settings";
import { renderGuarded } from "../testing/render";
import { addContext, deleteContext, makeDefaultContext, renameContext, saveContextWindows, saveSettings } from "./actions";
import { SettingsProse } from "./settings-prose";

vi.mock("./actions", () => ({
  saveSettings: vi.fn(),
  saveBusyCalendars: vi.fn(),
  saveContextWindows: vi.fn(),
  addContext: vi.fn(),
  renameContext: vi.fn(),
  makeDefaultContext: vi.fn(),
  deleteContext: vi.fn(),
}));

const initial: Settings = { ...DEFAULT_SETTINGS, timeZone: "Europe/London" };
const work: Context = { id: "work", name: "Work", windows: DEFAULT_WINDOWS, isDefault: true };

/** The windows sent with the latest save of Work. */
function lastSent(): WeeklyWindows {
  const call = vi.mocked(saveContextWindows).mock.calls.at(-1);
  expect(call?.[0]).toBe("work");
  return call?.[1] as WeeklyWindows;
}

async function openWeek() {
  await userEvent.click(screen.getByRole("button", { name: "09:00–17:00" }));
  return within(screen.getByRole("group", { name: "Hours" }));
}

describe("Contexts in prose Settings", () => {
  beforeEach(() => {
    vi.mocked(saveSettings).mockReset();
    vi.mocked(saveSettings).mockImplementation(async (settings) => ({ ok: true, settings: settings as Settings }));
    vi.mocked(saveContextWindows).mockReset();
    vi.mocked(saveContextWindows).mockImplementation(async (id, windows) => ({
      ok: true,
      context: { ...work, id, windows: windows as WeeklyWindows },
    }));
    renderGuarded(<SettingsProse initial={initial} contexts={[work]} calendar={{ status: "unreachable" }} />);
  });

  it("lists Work, the default, with its windows as week sentences, and never says Working Hours", () => {
    const heading = screen.getByRole("heading", { name: "Contexts" });
    const section = heading.nextElementSibling as HTMLElement;
    expect(section.textContent).toBe("Work, the default. Monday to Friday, 09:00–17:00. Saturday and Sunday are off.");
    expect(document.body.textContent).not.toMatch(/working hours/i);
  });

  it("saves edited hours for every weekday", async () => {
    const editor = await openWeek();
    for (let i = 0; i < 4; i++) await userEvent.click(editor.getByRole("button", { name: "End 15 minutes earlier" }));
    await waitFor(() => expect(saveContextWindows).toHaveBeenCalled());
    const sent = lastSent();
    for (const day of ["mon", "tue", "wed", "thu", "fri"] as const) {
      expect(sent[day]).toEqual([{ start: 540, end: 960 }]);
    }
    expect(sent.sat).toEqual([]);
    expect(sent.sun).toEqual([]);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Settings saved"));
  });

  it("gives Friday other hours without changing the other weekdays", async () => {
    const editor = await openWeek();
    await userEvent.click(editor.getByRole("button", { name: "Different hours on some days" }));
    await userEvent.click(editor.getByRole("button", { name: "Friday" }));
    await userEvent.click(editor.getByRole("button", { name: "Saturday" }));
    await userEvent.click(editor.getByRole("button", { name: "Sunday" }));
    await waitFor(() => expect(saveContextWindows).toHaveBeenCalled());
    const sent = lastSent();
    expect(sent.fri).toEqual([{ start: 600, end: 840 }]);
    for (const day of ["mon", "tue", "wed", "thu"] as const) {
      expect(sent[day]).toEqual([{ start: 540, end: 1020 }]);
    }
    expect(sent.sat).toEqual([]);
    // The sheet says the week in words, since on a phone it covers the sentence.
    expect(editor.getByText("Monday to Thursday, 09:00–17:00. Friday, 10:00–14:00. Saturday and Sunday are off.")).toBeTruthy();
    await userEvent.click(editor.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("heading", { name: "Contexts" }).nextElementSibling?.textContent).toBe(
      "Work, the default. Monday to Thursday, 09:00–17:00. Friday, 10:00–14:00. Saturday and Sunday are off.",
    );
  });

  it("holds overlapping windows unsaved while another setting can save", async () => {
    const editor = await openWeek();
    await userEvent.click(editor.getByRole("button", { name: "+ more hours" }));
    within(editor.getByRole("group", { name: "Hours 2" })).getByRole("slider", { name: "Start" }).focus();
    await userEvent.keyboard("{ArrowUp>8/}");
    expect(editor.getByRole("alert").textContent).toBe("09:00–17:00 overlaps 16:00–20:00.");
    expect(editor.getByRole("button", { name: "Done" })).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByRole("switch", { name: "Count free Events" }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    expect(saveContextWindows).not.toHaveBeenCalled();
  });
});

describe("adding a Context in Settings", () => {
  const deep: Context = { id: "deep", name: "Deep work", windows: DEFAULT_WINDOWS, isDefault: false };

  beforeEach(() => {
    vi.mocked(addContext).mockReset();
    vi.mocked(addContext).mockImplementation(async (input) => ({
      ok: true,
      context: { ...deep, ...(input as { name: string; windows: WeeklyWindows }) },
    }));
    renderGuarded(<SettingsProse initial={initial} contexts={[work, deep]} calendar={{ status: "unreachable" }} />);
  });

  async function startAdding(name: string) {
    await userEvent.click(screen.getByRole("button", { name: "+ Context" }));
    const form = within(screen.getByRole("form", { name: "New Context" }));
    if (name) await userEvent.type(form.getByRole("textbox", { name: "Name" }), name);
    return form;
  }

  it("adds one with a name and weekly windows, edited in the week editor", async () => {
    const form = await startAdding("Errands");
    await userEvent.click(form.getByRole("button", { name: "off" }));
    await userEvent.click(within(form.getByRole("group", { name: "Hours" })).getByRole("button", { name: "Saturday" }));

    await userEvent.click(form.getByRole("button", { name: "Add" }));

    const sent = vi.mocked(addContext).mock.calls[0][0] as { name: string; windows: WeeklyWindows };
    expect(sent.name).toBe("Errands");
    expect(sent.windows.mon).toEqual([{ start: 540, end: 1020 }]);
    expect(sent.windows.sat).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole("form", { name: "New Context" })).toBeNull());
  });

  it("refuses an empty name, saying so", async () => {
    const form = await startAdding("");

    await userEvent.click(form.getByRole("button", { name: "Add" }));

    expect(form.getByRole("alert").textContent).toBe("Give the Context a name.");
    expect(addContext).not.toHaveBeenCalled();
  });

  it("refuses a name over 20 characters", async () => {
    const form = await startAdding("Errands around the town");

    await userEvent.click(form.getByRole("button", { name: "Add" }));

    expect(form.getByRole("alert").textContent).toBe("Keep the name to 20 characters or fewer.");
    expect(addContext).not.toHaveBeenCalled();
  });

  it("refuses a name another Context has, ignoring case", async () => {
    const form = await startAdding("deep work");

    await userEvent.click(form.getByRole("button", { name: "Add" }));

    expect(form.getByRole("alert").textContent).toBe("There's already a Context called Deep work.");
    expect(addContext).not.toHaveBeenCalled();
  });

  it("refuses a Context with no windows", async () => {
    const form = await startAdding("Errands");
    await userEvent.click(form.getByRole("button", { name: "09:00–17:00" }));

    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
      await userEvent.click(within(form.getByRole("group", { name: "Hours" })).getByRole("button", { name: day }));
    }
    await userEvent.click(form.getByRole("button", { name: "Add" }));

    expect(form.getAllByRole("alert")[0].textContent).toBe("A Context needs at least one window in the week.");
    expect(addContext).not.toHaveBeenCalled();
  });

  it("shows the server's reason when it refuses", async () => {
    vi.mocked(addContext).mockResolvedValue({ ok: false, errors: { name: "There's already a Context called Errands." } });
    const form = await startAdding("Errands");

    await userEvent.click(form.getByRole("button", { name: "Add" }));

    expect((await form.findByRole("alert")).textContent).toBe("There's already a Context called Errands.");
    expect(screen.getByRole("form", { name: "New Context" })).toBeTruthy();
  });
});

describe("renaming, making default and deleting a Context in Settings", () => {
  const deep: Context = { id: "deep", name: "Deep work", windows: DEFAULT_WINDOWS, isDefault: false };

  beforeEach(() => {
    vi.mocked(renameContext).mockReset();
    vi.mocked(renameContext).mockImplementation(async (id, name) => ({ ok: true, context: { ...deep, id, name: name.trim() } }));
    vi.mocked(makeDefaultContext).mockReset();
    vi.mocked(makeDefaultContext).mockResolvedValue({ ok: true });
    vi.mocked(deleteContext).mockReset();
    vi.mocked(deleteContext).mockResolvedValue({ ok: true });
    renderGuarded(<SettingsProse initial={initial} contexts={[work, deep]} calendar={{ status: "unreachable" }} />);
  });

  it("shows Make default only on the Contexts that aren't the default, and Rename and Delete on each", () => {
    expect(screen.getAllByRole("button", { name: /^Make .* the default$/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Make Deep work the default",
    ]);
    expect(screen.getByRole("button", { name: "Make Deep work the default" }).textContent).toBe("Make default");
    for (const name of ["Work", "Deep work"]) {
      expect(screen.getByRole("button", { name: `Rename ${name}` }).textContent).toBe("Rename");
      expect(screen.getByRole("button", { name: `Delete ${name}` }).textContent).toBe("Delete");
    }
  });

  it("renames one, showing the new name", async () => {
    await userEvent.click(screen.getByRole("button", { name: "Rename Deep work" }));
    const name = screen.getByRole("textbox", { name: "New name for Deep work" });
    await userEvent.clear(name);
    await userEvent.type(name, "Focus");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(renameContext).toHaveBeenCalledWith("deep", "Focus");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Renamed to Focus"));
    expect(screen.getByText("Focus").tagName).toBe("STRONG");
    expect(screen.queryByRole("textbox", { name: "New name for Deep work" })).toBeNull();
  });

  it("refuses a new name by the same rules as adding, saving nothing", async () => {
    await userEvent.click(screen.getByRole("button", { name: "Rename Deep work" }));
    const name = screen.getByRole("textbox", { name: "New name for Deep work" });
    await userEvent.clear(name);
    await userEvent.type(name, "work");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert").textContent).toBe("There's already a Context called Work.");
    expect(renameContext).not.toHaveBeenCalled();
  });

  it("makes another the default", async () => {
    await userEvent.click(screen.getByRole("button", { name: "Make Deep work the default" }));

    expect(makeDefaultContext).toHaveBeenCalledWith("deep");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Deep work is the default"));
  });

  it("deletes one after asking, saying its Tasks move to the default", async () => {
    await userEvent.click(screen.getByRole("button", { name: "Delete Deep work" }));
    expect(screen.getByText("Delete Deep work? Its Tasks move to Work.")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    expect(deleteContext).toHaveBeenCalledWith("deep");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Deep work deleted"));
  });

  it("keeps one when deleting is cancelled", async () => {
    await userEvent.click(screen.getByRole("button", { name: "Delete Deep work" }));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText(/^Delete Deep work\?/)).toBeNull();
    expect(deleteContext).not.toHaveBeenCalled();
  });

  it("refuses to delete the default, saying to make another the default first", async () => {
    await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));

    expect(screen.getByRole("alert").textContent).toBe("Make another Context the default before deleting Work.");
    expect(deleteContext).not.toHaveBeenCalled();
  });
});

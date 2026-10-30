// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_WINDOWS, type Settings } from "@/core/settings";
import { PhoneSchedule } from "./home/phone/phone-schedule";
import { Calendar, type CalendarBlock, type CalendarConflict, type CalendarEvent } from "./schedule/calendar";
import { EmptyWeek } from "./schedule/empty-week";
import { EventDetails } from "./schedule/event-details";
import type { CalendarView } from "./settings/calendar-view";
import { SettingsProse } from "./settings/settings-prose";
import { SetupLetter } from "./setup/setup-letter";
import { ErrorScreen } from "./states/error-screen";
import { TaskEditorProvider, TaskEditorSlot } from "./tasks/task-editor-slot";
import { TaskPanel } from "./tasks/task-panel";
import { blockWording } from "./testing/block-wording";
import { taskItem, workContext } from "./testing/fixtures";
import { renderGuarded } from "./testing/render";

vi.mock("./schedule/actions", () => ({
  recalculate: vi.fn(),
  moveBlock: vi.fn(),
  unpinBlock: vi.fn(),
  createDynacalEvent: vi.fn(),
  updateDynacalEvent: vi.fn(),
  deleteDynacalEvent: vi.fn(),
  setBusyOverride: vi.fn(),
}));
vi.mock("./tasks/actions", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: vi.fn(),
  reopenTask: vi.fn(),
  clearDeclinedTime: vi.fn(),
  allowSplitting: vi.fn(),
  checkIn: vi.fn(),
}));
vi.mock("./settings/actions", () => ({
  saveSettings: vi.fn(),
  saveBusyCalendars: vi.fn(),
  saveContextWindows: vi.fn(),
  saveSetupWeek: vi.fn(),
}));

// Now is Tuesday 27 October 2026, 14:00 London time. "Pack for vegas" was at 10:30 and waits for a Check-in;
// "Print mystery machine" was at 08:00 and is answered; "Board memo" is pinned at 15:00, over Lunch with Sam.
const work = { id: "work", name: "Work", windows: DEFAULT_WINDOWS, isDefault: true };
const NOW = "2026-10-27T14:00:00.000Z";
const horizon = { start: NOW, end: "2026-11-10T14:00:00.000Z" };
const waiting: CalendarBlock = {
  id: "block-1", displayKey: "t1#1", taskId: "t1", taskTitle: "Pack for vegas",
  start: "2026-10-27T10:30:00.000Z", end: "2026-10-27T11:30:00.000Z", pinned: false,
};
const answered: CalendarBlock = {
  id: "block-2", displayKey: "t2#1", taskId: "t2", taskTitle: "Print mystery machine",
  start: "2026-10-27T08:00:00.000Z", end: "2026-10-27T09:00:00.000Z", pinned: false,
};
const pinned: CalendarBlock = {
  id: "block-3", displayKey: "t3#1", taskId: "t3", taskTitle: "Board memo",
  start: "2026-10-27T15:00:00.000Z", end: "2026-10-27T16:00:00.000Z", pinned: true,
};
const lunch: CalendarEvent = {
  id: "event-1", ref: { calendarId: "work", eventId: "event-1" }, title: "Lunch with Sam",
  calendarName: "Work", allDay: false, start: "2026-10-27T15:30:00.000Z", end: "2026-10-27T16:30:00.000Z",
  free: false, countsAsBusy: true, busyOverride: null, dynacalEvent: null,
};
const conflicts: CalendarConflict[] = [{ blockId: "block-3", eventId: "event-1" }];
const tasks = () => [
  taskItem({
    id: "t1",
    title: "Pack for vegas",
    checkIns: [{ blockId: "block-1", start: new Date(waiting.start), end: new Date(waiting.end) }],
  }),
  taskItem({ id: "t2", title: "Print mystery machine" }),
  taskItem({
    id: "t3",
    title: "Board memo",
    declinedTimes: [{ id: 1, start: new Date("2026-10-28T09:00:00Z"), end: new Date("2026-10-28T10:00:00Z") }],
  }),
];
const connected: CalendarView = {
  status: "connected",
  email: "owner@example.com",
  busyCalendarsChosen: true,
  calendars: [{ id: "work", name: "Work", primary: true, busy: true }],
};

/** The screen says nothing about Blocks, in its text or in what a screen reader hears. */
function expectTaskWords() {
  expect(blockWording(document.body)).toEqual([]);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => vi.useRealTimers());

describe("the owner never sees the word Block", () => {
  it("on the desktop home, its calendar and a pinned time's label", async () => {
    renderGuarded(
      <TaskEditorProvider>
        <TaskPanel contexts={[workContext]} tasks={tasks()} flags={{}} timeZone="Europe/London" />
        <Calendar
          timeZone="Europe/London"
          horizon={horizon}
          blocks={[answered, waiting, pinned]}
          events={[lunch]}
          conflicts={conflicts}
          contextWindows={DEFAULT_WINDOWS}
        />
      </TaskEditorProvider>,
    );
    expectTaskWords();

    await userEvent.click(screen.getByRole("button", { name: /^Board memo, 15:00/ }));
    expect(screen.getByRole("complementary", { name: "Board memo" })).toBeTruthy();
    expectTaskWords();
  });

  it("on the phone's week list and its sheets", async () => {
    renderGuarded(
      <TaskEditorProvider>
        <TaskPanel contexts={[workContext]} tasks={tasks()} flags={{}} timeZone="Europe/London" />
        <PhoneSchedule
          timeZone="Europe/London"
          horizon={horizon}
          blocks={[answered, waiting, pinned]}
          events={[lunch]}
          conflicts={conflicts}
        />
      </TaskEditorProvider>,
    );
    expectTaskWords();

    await userEvent.click(screen.getByRole("button", { name: /^Board memo, 15:00/ }));
    expect(screen.getByRole("complementary", { name: "Board memo" })).toBeTruthy();
    expectTaskWords();

    await userEvent.click(screen.getByRole("button", { name: /^Print mystery machine, 08:00/ }));
    expect(screen.getByRole("complementary", { name: "Print mystery machine" })).toBeTruthy();
    expectTaskWords();
  });

  it("in the Task editor, with a Declined Time", async () => {
    renderGuarded(
      <TaskEditorProvider>
        <TaskPanel contexts={[workContext]} tasks={tasks()} flags={{}} timeZone="Europe/London" />
        <TaskEditorSlot>
          <div>Calendar</div>
        </TaskEditorSlot>
      </TaskEditorProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Board memo/ }));
    expect(screen.getByRole("form", { name: "Edit Task" })).toBeTruthy();
    expectTaskWords();
  });

  it("in Settings, with the shortest split piece open", async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, timeZone: "Europe/London", minimumBlockMinutes: 30 };
    renderGuarded(<SettingsProse initial={settings} contexts={[work]} calendar={connected} />);
    await userEvent.click(screen.getByRole("button", { name: "30 minutes" }));
    expectTaskWords();
  });

  it("in onboarding", () => {
    const status = { googleConnected: true, busyCalendarsChosen: false, timeZoneSaved: false, complete: false };
    renderGuarded(<SetupLetter status={status} calendar={connected} settings={DEFAULT_SETTINGS} windows={DEFAULT_WINDOWS} />);
    expectTaskWords();
  });

  it("on the empty and error screens, and an Event that doesn't count as busy", () => {
    renderGuarded(
      <>
        <EmptyWeek today="2026-10-27" />
        <ErrorScreen offline={false} message="Boom" onRetry={() => {}} />
        <ErrorScreen offline onRetry={() => {}} />
        <EventDetails event={{ ...lunch, free: true, countsAsBusy: false }} timeZone="Europe/London" onClose={() => {}} />
      </>,
    );
    expectTaskWords();
  });
});

describe("the setting for split Tasks", () => {
  it("reads “Shortest split piece”, and says it's only for Tasks that can be split", async () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, timeZone: "Europe/London", minimumBlockMinutes: 30 };
    renderGuarded(<SettingsProse initial={settings} contexts={[work]} calendar={{ status: "unreachable" }} />);

    await userEvent.click(screen.getByRole("button", { name: "30 minutes" }));

    const editor = within(screen.getByRole("group", { name: "Shortest split piece" }));
    expect(editor.getByRole("spinbutton", { name: "Shortest split piece" })).toBeTruthy();
    expect(screen.getByText(/only Tasks that can be split/i)).toBeTruthy();
  });
});

import { describe, expect, it } from "vitest";
import { blockForReminderLink } from "./reminders";
import type { TaskInput } from "./tasks";
import { createTestApp, setDefaultWindows } from "./testing";

// The test clock starts at Monday 5 January 2026, 09:00 UTC; London is on UTC in winter.
const MINUTE = 60_000;

const oneHour: TaskInput = {
  title: "Write quarterly report",
  notes: "",
  estimatedMinutes: 60,
  deadline: null,
  earliestStart: null,
  priority: "medium",
  splittable: true,
};

const subscription = {
  endpoint: "https://push.example.com/send/abc",
  keys: { p256dh: "public-key", auth: "auth-secret" },
};

/** An app in London with one push subscription, whose working day starts at 10:00 so Blocks begin an hour from now. */
function appWithSubscription() {
  const app = createTestApp();
  app.commands.updateSettings({ timeZone: "Europe/London" });
  setDefaultWindows(app.commands, { mon: [{ start: 10 * 60, end: 17 * 60 }] });
  app.commands.subscribeToPush(subscription);
  return app;
}

function createTask(commands: ReturnType<typeof createTestApp>["commands"], input: Partial<TaskInput> = {}) {
  const result = commands.createTask({ ...oneHour, ...input });
  if (!result.ok) throw new Error("create failed");
  return result.task;
}

describe("reminders", () => {
  it("sends a push naming the Task, its start and its length at the Reminder Lead Time before its Block starts", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    createTask(commands, { estimatedMinutes: 90 });

    clock.set(new Date("2026-01-05T09:49:00Z"));
    await commands.sendDueReminders();
    expect(pushSender.sent).toEqual([]);

    clock.set(new Date("2026-01-05T09:50:00Z"));
    await commands.sendDueReminders();
    expect(pushSender.sent).toEqual([
      {
        endpoint: subscription.endpoint,
        message: { title: "Write quarterly report", body: "Starts at 10:00, in 10 minutes · 1h 30m", url: expect.any(String) },
      },
    ]);
  });

  it("links to its Block by Task and start, so tapping it opens that Block", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    const task = createTask(commands);

    clock.set(new Date("2026-01-05T09:50:00Z"));
    await commands.sendDueReminders();
    const [{ message }] = pushSender.sent;

    expect(message.url).toBe(`/?block=${task.id}%40${Date.parse("2026-01-05T10:00:00Z")}`);
    const schedule = commands.getSchedule();
    if (schedule.status !== "ready") throw new Error("no schedule");
    const opened = blockForReminderLink(new URL(message.url, "https://dynacal.test").searchParams.get("block"), schedule.blocks);
    expect(opened).toMatchObject({ taskId: task.id, start: new Date("2026-01-05T10:00:00Z") });
  });

  it("opens nothing when the reminded Block is gone or the link is malformed", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    const task = createTask(commands);
    clock.set(new Date("2026-01-05T09:50:00Z"));
    await commands.sendDueReminders();
    const block = new URL(pushSender.sent[0].message.url, "https://dynacal.test").searchParams.get("block");

    commands.deleteTask(task.id);
    const schedule = commands.getSchedule();
    if (schedule.status !== "ready") throw new Error("no schedule");
    expect(blockForReminderLink(block, schedule.blocks)).toBeNull();
    expect(blockForReminderLink("nonsense", schedule.blocks)).toBeNull();
    expect(blockForReminderLink(null, schedule.blocks)).toBeNull();
  });

  it("reminds about each Block only once, however often the job runs", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    createTask(commands);

    clock.set(new Date("2026-01-05T09:50:00Z"));
    await commands.sendDueReminders();
    clock.set(new Date("2026-01-05T09:51:00Z"));
    await commands.sendDueReminders();
    commands.recalculate();
    clock.set(new Date("2026-01-05T09:52:00Z"));
    await commands.sendDueReminders();

    expect(pushSender.sent).toHaveLength(1);
  });

  it("reminds about a Block that moved at its new time, even if its old reminder already went out", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    createTask(commands);
    clock.set(new Date("2026-01-05T09:50:00Z"));
    await commands.sendDueReminders();
    pushSender.sent = [];

    // Monday's windows now start at 11:00, so the Block moves there.
    clock.set(new Date("2026-01-05T09:55:00Z"));
    setDefaultWindows(commands, { mon: [{ start: 11 * 60, end: 17 * 60 }] });
    for (const at of ["2026-01-05T10:00:00Z", "2026-01-05T10:49:00Z"]) {
      clock.set(new Date(at));
      await commands.sendDueReminders();
    }
    expect(pushSender.sent).toEqual([]);

    clock.set(new Date("2026-01-05T10:50:00Z"));
    await commands.sendDueReminders();
    expect(pushSender.sent.map((p) => p.message.body)).toEqual(["Starts at 11:00, in 10 minutes · 1h"]);
  });

  it("drops the reminder for a Block that's deleted before it fires", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    const task = createTask(commands);

    clock.set(new Date("2026-01-05T09:45:00Z"));
    commands.deleteTask(task.id);
    clock.set(new Date("2026-01-05T09:50:00Z"));
    await commands.sendDueReminders();

    expect(pushSender.sent).toEqual([]);
  });

  it("uses the owner's Reminder Lead Time", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    commands.updateSettings({ reminderLeadMinutes: 30 });
    createTask(commands);

    clock.set(new Date("2026-01-05T09:29:00Z"));
    await commands.sendDueReminders();
    expect(pushSender.sent).toEqual([]);

    clock.set(new Date("2026-01-05T09:30:00Z"));
    await commands.sendDueReminders();
    expect(pushSender.sent.map((p) => p.message.body)).toEqual(["Starts at 10:00, in 30 minutes · 1h"]);
  });

  it("says the Block is starting now when the Reminder Lead Time is 0, even if the job runs a few seconds late", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    commands.updateSettings({ reminderLeadMinutes: 0 });
    createTask(commands);

    clock.set(new Date("2026-01-05T09:59:50Z"));
    await commands.sendDueReminders();
    expect(pushSender.sent).toEqual([]);

    clock.set(new Date("2026-01-05T10:00:20Z"));
    await commands.sendDueReminders();
    clock.set(new Date("2026-01-05T10:00:50Z"));
    await commands.sendDueReminders();
    expect(pushSender.sent.map((p) => p.message.body)).toEqual(["Starting now · 1h"]);
  });

  it("doesn't remind about a Block that has already started, e.g. after the server was down", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    createTask(commands);

    clock.set(new Date("2026-01-05T10:05:00Z"));
    await commands.sendDueReminders();

    expect(pushSender.sent).toEqual([]);
  });

  it("sends each reminder to every subscription, and forgets subscriptions the push service says are gone", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    const phone = { endpoint: "https://push.example.com/send/phone", keys: { p256dh: "k2", auth: "a2" } };
    commands.subscribeToPush(phone);
    pushSender.gone.add(subscription.endpoint);
    createTask(commands, { title: "First", estimatedMinutes: 30 });
    createTask(commands, { title: "Second", estimatedMinutes: 30 });

    clock.set(new Date("2026-01-05T09:50:00Z"));
    await commands.sendDueReminders();
    pushSender.gone.clear();
    clock.set(new Date("2026-01-05T10:20:00Z"));
    await commands.sendDueReminders();

    expect(pushSender.sent.map((p) => [p.message.title, p.endpoint])).toEqual([
      ["First", phone.endpoint],
      ["Second", phone.endpoint],
    ]);
  });

  it("stops reminding a browser once the owner turns reminders off there", async () => {
    const { commands, clock, pushSender } = appWithSubscription();
    createTask(commands);

    commands.unsubscribeFromPush(subscription.endpoint);
    clock.set(new Date("2026-01-05T09:50:00Z"));
    await commands.sendDueReminders();

    expect(pushSender.sent).toEqual([]);
  });

  it("refuses a subscription that isn't a valid push endpoint", () => {
    const { commands } = createTestApp();

    expect(commands.subscribeToPush({ endpoint: "not a url", keys: { p256dh: "k", auth: "a" } })).toEqual({
      ok: false,
      errors: { subscription: "This browser's push subscription couldn't be read. Try turning reminders on again." },
    });
    expect(commands.subscribeToPush(subscription)).toEqual({ ok: true });
  });
});

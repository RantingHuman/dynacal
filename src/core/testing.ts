import type { Clock } from "./clock";
import { createCommands, type Commands } from "./commands";
import { openDatabase } from "./db";
import { FakeCalendarGateway } from "./fake-calendar-gateway";
import type { PushMessage, PushOutcome, PushSender, PushSubscriptionInput } from "./push";
import type { WeeklyWindows } from "./settings";

/** A clock that only moves when a test tells it to. */
export class FakeClock implements Clock {
  constructor(private current: Date = new Date("2026-01-05T09:00:00Z")) {}
  now(): Date {
    return new Date(this.current);
  }
  set(to: Date): void {
    this.current = new Date(to);
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Records every push instead of sending it. Endpoints added to `gone` answer as expired subscriptions. */
export class FakePushSender implements PushSender {
  sent: { endpoint: string; message: PushMessage }[] = [];
  gone = new Set<string>();
  async send(subscription: PushSubscriptionInput, message: PushMessage): Promise<PushOutcome> {
    if (this.gone.has(subscription.endpoint)) return "gone";
    this.sent.push({ endpoint: subscription.endpoint, message });
    return "sent";
  }
}

/** The command layer wired to an in-memory database, a fake clock, a fake push sender and a fake Google account. */
export function createTestApp({ ownerEmail = "owner@example.com" }: { ownerEmail?: string } = {}) {
  const db = openDatabase(":memory:");
  const clock = new FakeClock();
  const pushSender = new FakePushSender();
  const calendar = new FakeCalendarGateway();
  const commands = createCommands({ db, clock, ownerEmail, pushSender, calendar });
  return { commands, clock, db, pushSender, calendar };
}

/** Changes the Default Context's windows on some days, as editing it in Settings does. */
export function setDefaultWindows(commands: Commands, days: Partial<WeeklyWindows>): void {
  const [context] = commands.listContexts();
  const result = commands.setContextWindows(context.id, { ...context.windows, ...days });
  if (!result.ok) throw new Error(`Windows refused: ${JSON.stringify(result)}`);
}

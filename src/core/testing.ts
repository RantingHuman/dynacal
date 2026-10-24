import type { Clock } from "./clock";
import { createCommands } from "./commands";
import { openDatabase } from "./db";
import { FakeCalendarGateway } from "./fake-calendar-gateway";

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

/** The command layer wired to an in-memory database, a fake clock and a fake Google account. */
export function createTestApp({ ownerEmail = "owner@example.com" }: { ownerEmail?: string } = {}) {
  const db = openDatabase(":memory:");
  const clock = new FakeClock();
  const calendar = new FakeCalendarGateway();
  const commands = createCommands({ db, clock, ownerEmail, calendar });
  return { commands, clock, db, calendar };
}

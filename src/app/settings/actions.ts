"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SetBusyCalendarsResult } from "@/core/commands";
import { WEEKDAYS, type UpdateSettingsResult } from "@/core/settings";
import { getRuntime } from "@/server/runtime";
import { requireOwner } from "@/server/session";

const timeWindowSchema = z.object({ start: z.number(), end: z.number() });

const settingsInput = z.object({
  workingHours: z.object(Object.fromEntries(WEEKDAYS.map((day) => [day, z.array(timeWindowSchema)])) as Record<
    (typeof WEEKDAYS)[number],
    z.ZodArray<typeof timeWindowSchema>
  >),
  timeZone: z.string().nullable(),
  minimumBlockMinutes: z.number(),
  reminderLeadMinutes: z.number(),
  countFreeEvents: z.boolean(),
  countAllDayEvents: z.boolean(),
  taskBufferAfterMinutes: z.number(),
});

export async function saveBusyCalendars(calendarIds: string[]): Promise<SetBusyCalendarsResult> {
  await requireOwner();
  const parsed = z.array(z.string()).parse(calendarIds);
  const result = await getRuntime().commands.setBusyCalendars(parsed);
  // Settings feed the Schedule, first-run setup and Settings pages alike.
  revalidatePath("/", "layout");
  return result;
}

export async function saveSettings(input: unknown): Promise<UpdateSettingsResult> {
  await requireOwner();
  const parsed = settingsInput.parse(input);
  const result = getRuntime().commands.updateSettings(parsed);
  // Settings feed the Schedule, first-run setup and Settings pages alike.
  revalidatePath("/", "layout");
  return result;
}

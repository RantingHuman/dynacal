"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SetBusyCalendarsResult } from "@/core/commands";
import type { SetContextWindowsResult, SetUpWeekResult } from "@/core/contexts";
import { WEEKDAYS, type UpdateSettingsResult } from "@/core/settings";
import { getRuntime } from "@/server/runtime";
import { requireOwner } from "@/server/session";

const timeWindowSchema = z.object({ start: z.number(), end: z.number() });

const windowsSchema = z.object(Object.fromEntries(WEEKDAYS.map((day) => [day, z.array(timeWindowSchema)])) as Record<
  (typeof WEEKDAYS)[number],
  z.ZodArray<typeof timeWindowSchema>
>);

const settingsInput = z.object({
  timeZone: z.string().nullable(),
  minimumBlockMinutes: z.number(),
  reminderLeadMinutes: z.number(),
  countFreeEvents: z.boolean(),
  countAllDayEvents: z.boolean(),
  taskBufferBeforeMinutes: z.number(),
  taskBufferAfterMinutes: z.number(),
  eventBufferBeforeMinutes: z.number(),
  eventBufferAfterMinutes: z.number(),
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

export async function saveContextWindows(id: string, windows: unknown): Promise<SetContextWindowsResult> {
  await requireOwner();
  const result = getRuntime().commands.setContextWindows(z.string().parse(id), windowsSchema.parse(windows));
  revalidatePath("/", "layout");
  return result;
}

/** First-run setup's last step: the time zone and the owner's hours, saved together as Work. */
export async function saveSetupWeek(input: unknown): Promise<SetUpWeekResult> {
  await requireOwner();
  const parsed = z.object({ timeZone: z.string(), windows: windowsSchema }).parse(input);
  const result = getRuntime().commands.setUpWeek(parsed);
  revalidatePath("/", "layout");
  return result;
}

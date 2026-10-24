"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
});

export async function saveSettings(input: unknown): Promise<UpdateSettingsResult> {
  await requireOwner();
  const parsed = settingsInput.parse(input);
  const result = getRuntime().commands.updateSettings(parsed);
  revalidatePath("/");
  return result;
}

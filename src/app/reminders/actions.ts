"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SubscribeToPushResult } from "@/core/push";
import { getRuntime } from "@/server/runtime";
import { requireOwner } from "@/server/session";

// Missing keys become empty strings, so the command layer's validation explains the problem to the owner.
const subscriptionInput = z.object({
  endpoint: z.string(),
  keys: z.object({ p256dh: z.string().default(""), auth: z.string().default("") }).default({ p256dh: "", auth: "" }),
});

export async function enableReminders(input: unknown): Promise<SubscribeToPushResult> {
  await requireOwner();
  const result = getRuntime().commands.subscribeToPush(subscriptionInput.parse(input));
  revalidatePath("/");
  return result;
}

export async function disableReminders(endpoint: unknown): Promise<void> {
  await requireOwner();
  getRuntime().commands.unsubscribeFromPush(z.string().parse(endpoint));
  revalidatePath("/");
}

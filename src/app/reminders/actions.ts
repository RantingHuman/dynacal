"use server";

import { z } from "zod";
import type { SubscribeToPushResult } from "@/core/push";
import { getRuntime } from "@/server/runtime";
import { requireOwner } from "@/server/session";

const subscriptionInput = z.object({
  endpoint: z.string(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export async function enableReminders(input: unknown): Promise<SubscribeToPushResult> {
  await requireOwner();
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: { subscription: "This browser's push subscription couldn't be read. Try turning reminders on again." },
    };
  }
  return getRuntime().commands.subscribeToPush(parsed.data);
}

export async function disableReminders(endpoint: unknown): Promise<void> {
  await requireOwner();
  getRuntime().commands.unsubscribeFromPush(z.string().parse(endpoint));
}

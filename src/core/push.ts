/** A browser's push subscription, as `PushSubscription.toJSON()` gives it. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type SubscribeToPushResult = { ok: true } | { ok: false; errors: { subscription: string } };

/** Push services only accept https endpoints, and every subscription carries both keys. */
export function validatePushSubscription(subscription: PushSubscriptionInput): { subscription: string } | null {
  let https = false;
  try {
    https = new URL(subscription.endpoint).protocol === "https:";
  } catch {
    // Not a URL at all.
  }
  if (https && subscription.keys.p256dh.length > 0 && subscription.keys.auth.length > 0) return null;
  return { subscription: "This browser's push subscription couldn't be read. Try turning reminders on again." };
}

/** What the service worker shows: a notification that opens `url` when tapped. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

/** "gone" means the push service no longer knows the subscription, so it should be forgotten. */
export type PushOutcome = "sent" | "gone" | "failed";

/** The port to web push delivery. The real adapter is in `src/server/`; tests use `FakePushSender`. */
export interface PushSender {
  send(subscription: PushSubscriptionInput, message: PushMessage): Promise<PushOutcome>;
}

import webpush, { WebPushError } from "web-push";
import type { PushMessage, PushOutcome, PushSender, PushSubscriptionInput } from "@/core/push";
import type { Config } from "./config";
import { isHttps } from "@/core/urls";

/** Reminders are only useful for a few minutes; after that the push service may drop them. */
const TIME_TO_LIVE_SECONDS = 10 * 60;

/** The real push sender: delivers through each browser's push service, signed with the deployment's VAPID keys. */
export function createWebPushSender(config: Config): PushSender {
  const vapidDetails = {
    // Push services contact this if something goes wrong; it must be an https URL or a mailto: address.
    subject: isHttps(config.PUBLIC_BASE_URL) ? config.PUBLIC_BASE_URL : `mailto:${config.OWNER_EMAIL}`,
    publicKey: config.VAPID_PUBLIC_KEY,
    privateKey: config.VAPID_PRIVATE_KEY,
  };
  return {
    async send(subscription: PushSubscriptionInput, message: PushMessage): Promise<PushOutcome> {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(message), {
          vapidDetails,
          TTL: TIME_TO_LIVE_SECONDS,
          urgency: "high",
        });
        return "sent";
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return "gone";
        console.error("Couldn't send a reminder push:", error instanceof Error ? error.message : error);
        return "failed";
      }
    },
  };
}

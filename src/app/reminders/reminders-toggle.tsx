"use client";

import { useEffect, useState } from "react";
import { disableReminders, enableReminders } from "./actions";

type State =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "off"; message?: string }
  | { kind: "on"; endpoint: string }
  | { kind: "working" };

/** A push service wants the VAPID public key as bytes; the config holds it base64url-encoded. */
function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Registers the service worker (which also makes dynacal installable) and lets the owner turn
 * web push reminders on or off for this browser.
 */
export function RemindersToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState({ kind: "unsupported" });
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setState(subscription ? { kind: "on", endpoint: subscription.endpoint } : { kind: "off" }))
      .catch(() => setState({ kind: "unsupported" }));
  }, []);

  async function turnOn() {
    setState({ kind: "working" });
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setState({ kind: "off", message: "Notifications are blocked for dynacal in this browser's settings." });
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(vapidPublicKey),
      });
      const result = await enableReminders(subscription.toJSON());
      if (!result.ok) {
        await subscription.unsubscribe();
        setState({ kind: "off", message: result.errors.subscription });
        return;
      }
      setState({ kind: "on", endpoint: subscription.endpoint });
    } catch {
      setState({ kind: "off", message: "Reminders couldn't be turned on in this browser." });
    }
  }

  async function turnOff(endpoint: string) {
    setState({ kind: "working" });
    const registration = await navigator.serviceWorker.ready;
    await (await registration.pushManager.getSubscription())?.unsubscribe();
    await disableReminders(endpoint);
    setState({ kind: "off" });
  }

  if (state.kind === "loading") return null;
  if (state.kind === "unsupported") {
    return (
      <span className="muted" title="On iPhone, add dynacal to your Home Screen first, then open it from there.">
        Reminders unavailable here
      </span>
    );
  }
  if (state.kind === "on") {
    return (
      <button className="link" type="button" onClick={() => turnOff(state.endpoint)}>
        Turn off reminders
      </button>
    );
  }
  return (
    <>
      {state.kind === "off" && state.message && (
        <span className="field-error" role="alert">
          {state.message}
        </span>
      )}
      <button className="link" type="button" disabled={state.kind === "working"} onClick={turnOn}>
        Enable reminders
      </button>
    </>
  );
}

import { CalendarAuthError } from "./calendar-gateway";
import type { GoogleConnectionView } from "./google-connection";

/**
 * Connection health: the one place that decides the Google connection is broken. Wraps a calendar gateway so
 * that every method on it, including ones later tickets add (writing Blocks, push channels), calls
 * `onAuthError` when Google refuses dynacal's credentials. The error is still thrown to the caller.
 */
export function watchConnectionHealth<Gateway extends object>(gateway: Gateway, onAuthError: () => void): Gateway {
  return new Proxy(gateway, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        try {
          return await value.apply(target, args);
        } catch (error) {
          if (error instanceof CalendarAuthError) onAuthError();
          throw error;
        }
      };
    },
  });
}

/** Why Google can't be used right now, as a command result. */
export type ConnectionProblem = { ok: false; reason: "not-connected" | "connection-broken" };

/** The command result for a connection that isn't usable; null while it's healthy. */
export function connectionProblem(connection: GoogleConnectionView): ConnectionProblem | null {
  if (connection.status === "not-connected") return { ok: false, reason: "not-connected" };
  // Credentials Google has refused stay refused; only reconnecting recovers.
  if (connection.status === "broken") return { ok: false, reason: "connection-broken" };
  return null;
}

/**
 * Runs work that reaches Google. If Google refuses dynacal's credentials (the connection is then already
 * marked broken), the result is `{ ok: false, reason: "connection-broken" }`; other failures are thrown.
 */
export async function unlessRefused<T>(work: () => Promise<T>): Promise<T | { ok: false; reason: "connection-broken" }> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof CalendarAuthError) return { ok: false, reason: "connection-broken" };
    throw error;
  }
}

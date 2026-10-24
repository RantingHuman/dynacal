import { CalendarAuthError } from "./calendar-gateway";

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

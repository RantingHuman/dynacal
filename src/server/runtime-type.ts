import type { Google } from "arctic";
import type { Commands } from "@/core/commands";
import type { Config } from "./config";

/**
 * The process-wide wiring the app runs on. Its own module so the browser tests' substitute runtime is checked
 * against the same shape as the real one in `runtime.ts`.
 */
export interface Runtime {
  config: Config;
  commands: Commands;
  google: Google;
  now: () => Date;
}

import { z } from "zod";

const REQUIRED = {
  GOOGLE_CLIENT_ID: "Google OAuth client ID",
  GOOGLE_CLIENT_SECRET: "Google OAuth client secret",
  OWNER_EMAIL: "the owner's Google account email",
  PUBLIC_BASE_URL: "the URL this deployment is reached at, e.g. https://dynacal.example.com",
  VAPID_PUBLIC_KEY: "web push public key",
  VAPID_PRIVATE_KEY: "web push private key",
} as const;

const schema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  OWNER_EMAIL: z.email(),
  PUBLIC_BASE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  DATABASE_PATH: z.string().min(1).default("./data/dynacal.db"),
});

export type Config = z.infer<typeof schema>;

export class ConfigError extends Error {}

/** Reads the deployment's configuration from the environment, failing with every problem listed at once. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const blankToUndefined = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, value?.trim() ? value.trim() : undefined]),
  );
  const result = schema.safeParse(blankToUndefined);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const key = String(issue.path[0]);
    const description = REQUIRED[key as keyof typeof REQUIRED];
    return blankToUndefined[key] === undefined
      ? `  - ${key} is missing (${description})`
      : `  - ${key} is invalid: ${issue.message}`;
  });
  throw new ConfigError(
    `dynacal can't start because its configuration is incomplete:\n${problems.join("\n")}\n` +
      "See docs/self-hosting.md for how to set these.",
  );
}

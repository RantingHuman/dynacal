"use client";

import { ErrorScreen } from "./states/error-screen";
import { useOnline } from "./states/use-online";

/** Every screen's error page. A request that failed because the browser is offline says so instead. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const online = useOnline();
  return <ErrorScreen offline={!online} message={error.message || error.digest} onRetry={reset} />;
}

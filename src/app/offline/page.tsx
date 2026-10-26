"use client";

import { ErrorScreen } from "../states/error-screen";

/**
 * What the service worker serves for a page it can't fetch and has no copy of: the error page, saying the app
 * is offline. It needs no session, so the service worker can save it when it installs.
 */
export default function OfflinePage() {
  return <ErrorScreen offline onRetry={() => window.location.reload()} />;
}

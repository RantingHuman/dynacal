"use client";

import { useEffect } from "react";

/**
 * Once a tapped reminder's link (`/?block=…`) has opened the page on its Block, takes `block` out of the address,
 * so reloading the page doesn't open the Block again. Renders nothing.
 */
export function ForgetReminderLink() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("block")) return;
    url.searchParams.delete("block");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  return null;
}

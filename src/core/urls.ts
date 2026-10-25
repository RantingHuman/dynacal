/** Whether a URL is https: Google only delivers push notifications there, and secure cookies need it. */
export function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

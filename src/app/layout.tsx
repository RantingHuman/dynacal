import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { sans, serif } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "dynacal",
  description: "Your Tasks, scheduled around your calendar.",
  manifest: "/manifest.webmanifest",
  // iOS only delivers web push to apps added to the Home Screen.
  appleWebApp: { capable: true, title: "dynacal", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  // The paper token, light and dark (see globals.css).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#151412" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}

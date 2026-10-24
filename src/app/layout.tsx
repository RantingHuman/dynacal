import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
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
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

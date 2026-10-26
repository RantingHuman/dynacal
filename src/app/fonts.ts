import { Instrument_Sans, Instrument_Serif } from "next/font/google";

// next/font downloads both faces at build time and serves them from dynacal, so a browser never contacts Google.
// globals.css reads the variables through --font-serif and --font-sans.

/** The serif, for content: headings, Task, Block and Event titles, day numbers. */
export const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

/** The sans, for controls: buttons, form fields, meta lines, kickers and hour labels. */
export const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" });

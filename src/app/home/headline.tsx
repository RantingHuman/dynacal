"use client";

import { useState, ViewTransition } from "react";
import type { Headline as HeadlineWords } from "@/core/headline";
import { weekGotBetter } from "@/core/motion";
import type { WeekState } from "@/core/week-summary";
import styles from "./home.module.css";

/** A wave drawn past both ends, so sliding it one wavelength along loops without a gap. */
function Squiggle() {
  return (
    <svg className={styles.squiggle} viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
      <path
        pathLength={1}
        d="M-24 6 Q -18 0, -12 6 T 0 6 T 12 6 T 24 6 T 36 6 T 48 6 T 60 6 T 72 6 T 84 6 T 96 6 T 108 6 T 120 6 T 132 6 T 144 6 T 156 6 T 168 6 T 180 6 T 192 6 T 204 6 T 216 6"
      />
    </svg>
  );
}

/**
 * The headline, its emphasised phrase underlined with a squiggle. It rises in on a full page load only (it stays
 * mounted as the page refreshes); when the week's state changes it cross-fades to its new wording, and if the
 * week got better its squiggle draws in again. The squiggle is the page's one looping motion.
 */
export function Headline({ headline: { headline }, state }: { headline: HeadlineWords; state: WeekState }) {
  const [last, setLast] = useState({ state, draws: 0 });
  if (state !== last.state) setLast({ state, draws: last.draws + (weekGotBetter(last.state, state) ? 1 : 0) });

  return (
    <ViewTransition default="none" update="headline">
      <h1 className={styles.headline}>
        {headline.before}
        <span className={styles.emphasis}>
          <em>{headline.emphasis}</em>
          <Squiggle key={last.draws} />
        </span>
        {headline.after}
      </h1>
    </ViewTransition>
  );
}

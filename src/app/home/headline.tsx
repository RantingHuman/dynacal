"use client";

import { useState, ViewTransition } from "react";
import type { Headline as HeadlineWords } from "@/core/headline";
import { weekGotBetter } from "@/core/motion";
import type { WeekState } from "@/core/week-summary";
import { Squiggle } from "../states/squiggle";
import styles from "./home.module.css";

/**
 * The headline, its emphasised phrase underlined with a squiggle. It rises in on a full page load only (it stays
 * mounted as the page refreshes); when the week's state changes it cross-fades to its new wording, and if the
 * week got better its squiggle draws in again. The squiggle is the page's one looping motion.
 */
export function Headline({ headline: { headline }, state }: { headline: HeadlineWords; state?: WeekState }) {
  // Without a state (e.g. on the error screen) the headline never changes, so there's nothing to compare.
  const [last, setLast] = useState({ state, draws: 0 });
  if (state !== last.state) {
    const better = state !== undefined && last.state !== undefined && weekGotBetter(last.state, state);
    setLast({ state, draws: last.draws + (better ? 1 : 0) });
  }

  return (
    <ViewTransition default="none" update="headline">
      <h1 className={styles.headline}>
        {headline.before}
        <span className={styles.emphasis}>
          <em>{headline.emphasis}</em>
          <Squiggle key={last.draws} motion="draw-wiggle" className={styles.squiggle} />
        </span>
        {headline.after}
      </h1>
    </ViewTransition>
  );
}

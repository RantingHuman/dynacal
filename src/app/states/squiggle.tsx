import styles from "./squiggle.module.css";

/** One wavelength of the wave, in the squiggle's own units; it's 12 units tall. */
const WAVELENGTH = 24;

/**
 * How the squiggle moves: not at all; drawn in once from the left; drawn in, held and rubbed out over and over
 * (while loading); its wave sliding along forever (the Recalculate ripple); or drawn in and then sliding (under
 * the headline, the page's one constant motion).
 */
export type SquiggleMotion = "still" | "draw" | "loop" | "wiggle" | "draw-wiggle";

/** The wave from `from` to `to`: half-waves 12 units long, up then down. */
function wave(from: number, to: number): string {
  let d = `M${from} 6 Q ${from + 6} 0, ${from + 12} 6`;
  for (let x = from + 24; x <= to; x += 12) d += ` T ${x} 6`;
  return d;
}

/**
 * The accent squiggle, the app's one decorative mark: under the headline's emphasis, today's date on a phone,
 * "All done.", "All caught up.", the sign-in title, the loading line and Recalculate while it runs. It stretches
 * to its box; size it (and, for a thin or short one, `--squiggle-stroke`) with `className`.
 */
export function Squiggle({
  waves = 8,
  motion = "still",
  className = "",
}: {
  /** How many wavelengths fit across it. */
  waves?: number;
  motion?: SquiggleMotion;
  className?: string;
}) {
  const width = waves * WAVELENGTH;
  // A sliding wave is drawn a wavelength past both ends, so sliding it one wavelength loops without a gap.
  const sliding = motion === "wiggle" || motion === "draw-wiggle";
  return (
    <svg
      className={`${styles.squiggle} ${className}`}
      data-motion={motion}
      viewBox={`0 0 ${width} 12`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path pathLength={1} d={sliding ? wave(-WAVELENGTH, width + WAVELENGTH) : wave(0, width)} />
    </svg>
  );
}

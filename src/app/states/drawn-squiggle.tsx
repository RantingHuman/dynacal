import styles from "./states.module.css";

/**
 * The accent squiggle, drawn in from left to right: once (under "All done."), or over and over while the page
 * loads.
 */
export function DrawnSquiggle({ loop = false, className = "" }: { loop?: boolean; className?: string }) {
  return (
    <svg
      className={`${styles.drawn} ${className}`}
      data-loop={loop}
      viewBox="0 0 192 12"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        pathLength={1}
        d="M0 6 Q 6 0, 12 6 T 24 6 T 36 6 T 48 6 T 60 6 T 72 6 T 84 6 T 96 6 T 108 6 T 120 6 T 132 6 T 144 6 T 156 6 T 168 6 T 180 6 T 192 6"
      />
    </svg>
  );
}

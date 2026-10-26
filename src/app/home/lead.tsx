import type { Headline } from "@/core/headline";
import styles from "./home.module.css";

/** A wave drawn past both ends, so sliding it one wavelength along loops without a gap. */
function Squiggle() {
  return (
    <svg className={styles.squiggle} viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
      <path d="M-24 6 Q -18 0, -12 6 T 0 6 T 12 6 T 24 6 T 36 6 T 48 6 T 60 6 T 72 6 T 84 6 T 96 6 T 108 6 T 120 6 T 132 6 T 144 6 T 156 6 T 168 6 T 180 6 T 192 6 T 204 6 T 216 6" />
    </svg>
  );
}

/** The lead: the headline, its emphasised phrase underlined with a squiggle, and the standfirst with its links. */
export function Lead({ headline: { headline, standfirst } }: { headline: Headline }) {
  return (
    <section className={styles.lead} aria-label="Your week">
      <h1 className={styles.headline}>
        {headline.before}
        <span className={styles.emphasis}>
          <em>{headline.emphasis}</em>
          <Squiggle />
        </span>
        {headline.after}
      </h1>
      <p className={styles.standfirst}>
        {standfirst.map((part, i) =>
          typeof part === "string" ? (
            part
          ) : (
            <a key={i} href={part.href}>
              {part.text}
            </a>
          ),
        )}
      </p>
    </section>
  );
}

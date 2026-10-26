import type { Headline as HeadlineWords } from "@/core/headline";
import type { WeekState } from "@/core/week-summary";
import { Headline } from "./headline";
import styles from "./home.module.css";

/** The lead: the headline (see `Headline`) and the standfirst with its links. */
export function Lead({ headline, state }: { headline: HeadlineWords; state?: WeekState }) {
  const { standfirst } = headline;
  return (
    <section className={styles.lead} aria-label="Your week">
      <Headline headline={headline} state={state} />
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

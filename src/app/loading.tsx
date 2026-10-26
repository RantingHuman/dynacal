import { Masthead } from "./home/masthead";
import homeStyles from "./home/home.module.css";
import { Squiggle } from "./states/squiggle";
import styles from "./states/states.module.css";

/**
 * Every screen's loading screen: the masthead and an empty headline line along which the squiggle draws itself
 * over and over. It fades in only once loading has taken 300ms, so a fast load never flashes it.
 */
export default function Loading() {
  return (
    <div className={`${homeStyles.page} ${styles.loading}`} role="status" aria-label="Loading">
      <Masthead />
      <div className={styles.loadingLine}>
        <Squiggle motion="loop" />
      </div>
    </div>
  );
}

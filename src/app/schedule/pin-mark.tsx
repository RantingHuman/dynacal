import styles from "./pin-mark.module.css";

/** The small accent diamond before a Pinned Block's title, in the calendar and the phone's week list. */
export function PinMark() {
  return (
    <span className={styles.pinMark} aria-hidden>
      ◆{" "}
    </span>
  );
}

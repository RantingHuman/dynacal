"use client";

import { startTransition, useCallback, useEffect, useRef, ViewTransition } from "react";
import { useEscape } from "../states/use-escape";
import styles from "./floating-label.module.css";

/**
 * The floating label in the corner of the screen, where Block and Event details and Conflict resolution open, so the calendar stays in view. Escape closes it.
 *
 * It rises 24px and fades in as it opens (CSS), and fades out quickly as it closes: closing runs in a Transition,
 * so its `<ViewTransition>` can show the exit. Render it as the top element of whatever opens it.
 */
export function FloatingLabel({
  kind,
  labelledBy,
  onClose,
  children,
}: {
  /** What's open, in small capitals above the title, e.g. "Pinned Block". */
  kind: string;
  /** The id of the label's title. */
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const close = useLabelClose(onClose);

  return (
    <LabelFrame className={styles.label} labelledBy={labelledBy}>
      <div className={styles.top}>
        <span className={styles.kind}>{kind}</span>
        <button type="button" className={`link ${styles.close}`} onClick={close}>
          Close
        </button>
      </div>
      {children}
    </LabelFrame>
  );
}

/**
 * Closes a label, or anything that opens like one, in a Transition so its exit shows; Escape closes it too, unless
 * `escapes` says something over it should have Escape instead. Use what it returns for every way of closing.
 */
export function useLabelClose(onClose: () => void, escapes = true): () => void {
  const close = useCallback(() => startTransition(onClose), [onClose]);
  useEscape(close, escapes);
  return close;
}

/** How far down a card has to be swiped to close it. */
const SWIPE_CLOSE_PX = 60;

/**
 * What lets a card close by a tap outside it or a swipe down it, as `onDismiss`. A tap on a message (see `Toast`)
 * doesn't count, as its Undo belongs with the card. The tap is seen before it reaches what's under it, so tapping
 * another Task closes this card and then opens that one's.
 */
function useDismiss(onDismiss: (() => void) | undefined) {
  const frame = useRef<HTMLElement>(null);
  /** Where a swipe began, while one is under way. */
  const swipeFrom = useRef<number | null>(null);

  useEffect(() => {
    if (!onDismiss) return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || frame.current?.contains(e.target)) return;
      if (!e.target.closest("[data-toast]")) onDismiss();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [onDismiss]);

  const follow = (distance: number) => {
    if (frame.current) frame.current.style.transform = distance > 0 ? `translateY(${distance}px)` : "";
  };
  return {
    ref: frame,
    onTouchStart: (e: React.TouchEvent) => {
      // A card scrolled down part way is being scrolled, not swiped.
      swipeFrom.current = onDismiss && frame.current?.scrollTop === 0 ? e.touches[0].clientY : null;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (swipeFrom.current !== null) follow(e.touches[0].clientY - swipeFrom.current);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (swipeFrom.current === null) return;
      const distance = e.changedTouches[0].clientY - swipeFrom.current;
      swipeFrom.current = null;
      follow(0);
      if (distance >= SWIPE_CLOSE_PX) onDismiss?.();
    },
    onTouchCancel: () => {
      swipeFrom.current = null;
      follow(0);
    },
  };
}

/**
 * A card that opens and closes like the floating label (the label itself, and the Block sheet on a phone): it
 * rises and fades in, and fades out when it's closed in a Transition (see `useLabelClose`). `className` places
 * and draws it. With `onDismiss`, a tap outside it or a swipe down it closes it too.
 */
export function LabelFrame({
  className,
  labelledBy,
  onDismiss,
  children,
}: {
  className: string;
  labelledBy: string;
  onDismiss?: () => void;
  children: React.ReactNode;
}) {
  const dismiss = useDismiss(onDismiss);
  return (
    <ViewTransition default="none" exit="label-close">
      {/* data-refresh-hold: a background refresh waits until it closes (see BackgroundRefresh). */}
      <aside {...dismiss} className={`${styles.opening} ${className}`} aria-labelledby={labelledBy} data-refresh-hold>
        {children}
      </aside>
    </ViewTransition>
  );
}

/** The label's title, in the large serif. */
export function LabelTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className={styles.title}>
      {children}
    </h2>
  );
}

/** The italic line under the title: when it is. */
export function LabelTime({ children }: { children: React.ReactNode }) {
  return <p className={styles.time}>{children}</p>;
}

/** A one-line note in the label, e.g. the move/resize hint. */
export function LabelNote({ alert = false, children }: { alert?: boolean; children: React.ReactNode }) {
  return (
    <p className={alert ? styles.alert : styles.note} role={alert ? "alert" : undefined}>
      {children}
    </p>
  );
}

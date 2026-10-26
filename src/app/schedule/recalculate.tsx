"use client";

import { addTransitionType, useEffect, useState, useTransition } from "react";
import { movedBlocks } from "@/core/motion";
import { Squiggle } from "../states/squiggle";
import { OFFLINE_REASON, useOnline } from "../states/use-online";
import { recalculate } from "./actions";
import type { CalendarBlock } from "./calendar";
import styles from "./recalculate.module.css";

/** How long moved Blocks glide after a Recalculation, and the gap between one starting and the next (--slow, --stagger). */
const GLIDE_MS = 600;
const STAGGER_MS = 30;

export interface Recalculation {
  /** Whether a Recalculation is running. */
  pending: boolean;
  run: () => void;
  /** The display keys of the Blocks the last Recalculation moved, in order, until they've glided into place. */
  gliding: string[];
}

/**
 * Recalculating from a button. While it runs nothing else is said; as it finishes, `announce` gets "3 Blocks
 * moved" (or nothing, if none did), and `gliding` lists the moved Blocks until they've had time to glide. It runs
 * in a Transition of type "recalculate", which is what lets the calendar's Blocks glide (see `Calendar`).
 */
export function useRecalculate(blocks: CalendarBlock[], announce: (message: string | null) => void): Recalculation {
  const [pending, startTransition] = useTransition();
  /** The Blocks as they were when Recalculate was pressed, until the moved ones have glided into place. */
  const [glideFrom, setGlideFrom] = useState<CalendarBlock[] | null>(null);

  const finished = !pending && glideFrom !== null;
  const movedCount = finished ? movedBlocks(glideFrom, blocks).length : 0;
  useEffect(() => {
    if (!finished) return;
    if (movedCount > 0) announce(`${movedCount} ${movedCount === 1 ? "Block" : "Blocks"} moved`);
    const timer = setTimeout(() => setGlideFrom(null), GLIDE_MS + movedCount * STAGGER_MS);
    return () => clearTimeout(timer);
  }, [finished, movedCount, announce]);

  function run() {
    setGlideFrom(blocks);
    announce(null);
    startTransition(async () => {
      addTransitionType("recalculate");
      await recalculate();
    });
  }

  return { pending, run, gliding: glideFrom === null ? [] : movedBlocks(glideFrom, blocks) };
}

/**
 * The Recalculate button, on the calendar's toolbar and in the phone's Menu: a squiggle ripples under it while it
 * runs. Offline it's disabled and says why. While Google access is broken it still works, planning around the
 * Events dynacal last saw, and says so.
 */
export function RecalculateButton({
  recalculation: { pending, run },
  connectionBroken,
  stacked = false,
}: {
  recalculation: Recalculation;
  connectionBroken: boolean;
  /** The note under the button (in the phone's Menu) rather than beside it (on the toolbar). */
  stacked?: boolean;
}) {
  const online = useOnline();
  return (
    <span className={styles.recalculate} data-stacked={stacked || undefined}>
      <button
        type="button"
        className={`link ${styles.button}`}
        disabled={pending || !online}
        aria-busy={pending}
        title={online ? undefined : OFFLINE_REASON}
        onClick={run}
      >
        {pending ? "Recalculating…" : "Recalculate"}
        {pending && <Squiggle waves={5} motion="wiggle" className={styles.ripple} />}
      </button>
      {connectionBroken && <span className={styles.note}>Uses the last Events dynacal saw</span>}
    </span>
  );
}

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

/** "Moved “Pack for vegas”" or "Moved 3 Tasks": the Tasks whose times moved (by display key), or null if none did. */
function movedMessage(movedKeys: string[], blocks: CalendarBlock[]): string | null {
  const byKey = new Map(blocks.map((b) => [b.displayKey, b]));
  const titles = new Map(movedKeys.map((key) => byKey.get(key)!).map((b) => [b.taskId, b.taskTitle]));
  if (titles.size === 0) return null;
  return titles.size === 1 ? `Moved “${[...titles.values()][0]}”` : `Moved ${titles.size} Tasks`;
}

/**
 * Recalculating from a button. While it runs nothing else is said; as it finishes, `announce` gets "Moved 3
 * Tasks" (or nothing, if none did), and `gliding` lists the moved Blocks until they've had time to glide. It runs
 * in a Transition of type "recalculate", which is what lets the calendar's Blocks glide (see `Calendar`).
 */
export function useRecalculate(blocks: CalendarBlock[], announce: (message: string | null) => void): Recalculation {
  const [pending, startTransition] = useTransition();
  /** The Blocks as they were when Recalculate was pressed, until the moved ones have glided into place. */
  const [glideFrom, setGlideFrom] = useState<CalendarBlock[] | null>(null);

  const finished = !pending && glideFrom !== null;
  const moved = finished ? movedBlocks(glideFrom, blocks) : [];
  const movedCount = moved.length;
  const message = movedMessage(moved, blocks);
  useEffect(() => {
    if (!finished) return;
    if (message) announce(message);
    const timer = setTimeout(() => setGlideFrom(null), GLIDE_MS + movedCount * STAGGER_MS);
    return () => clearTimeout(timer);
  }, [finished, movedCount, message, announce]);

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

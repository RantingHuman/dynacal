"use client";

import { useState, useTransition } from "react";
import { blockMinutes, canBePartlyDone, type ReviewOutcome } from "@/core/completion";
import { formatDuration } from "@/core/tasks";
import { reviewBlock } from "./actions";
import styles from "./review-box.module.css";

export interface UnreviewedBlockProps {
  id: string;
  taskTitle: string;
  /** ISO instants */
  start: string;
  end: string;
  suggestedWorkedMinutes: number;
}

/**
 * The Unreviewed Blocks, as a quote box under the Task list: one Block at a time, asking whether its work
 * happened, with a "1 of 4 ‹ ›" pager when there are several. It disappears once all are reviewed.
 */
export function ReviewBox({ blocks, timeZone }: { blocks: UnreviewedBlockProps[]; timeZone: string }) {
  const [index, setIndex] = useState(0);
  if (blocks.length === 0) return null;
  // A reviewed Block leaves the list, so the one after it takes its place; past the end, show the last.
  const shown = Math.min(index, blocks.length - 1);
  const block = blocks[shown];
  return (
    <section className={styles.box} aria-label="Unreviewed Blocks">
      <ReviewQuote key={block.id} block={block} timeZone={timeZone} />
      {blocks.length > 1 && (
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Previous Unreviewed Block"
            disabled={shown === 0}
            onClick={() => setIndex(shown - 1)}
          >
            ‹
          </button>
          <span aria-live="polite">
            {shown + 1} of {blocks.length} to review
          </span>
          <button
            type="button"
            className={styles.arrow}
            aria-label="Next Unreviewed Block"
            disabled={shown === blocks.length - 1}
            onClick={() => setIndex(shown + 1)}
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}

function formatSpan(start: Date, end: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  return `${day.format(start)}, ${time.format(start)}–${time.format(end)}`;
}

/** One Unreviewed Block: did its work happen? Until the owner says, it counts as worked. */
function ReviewQuote({ block, timeZone }: { block: UnreviewedBlockProps; timeZone: string }) {
  const span = { start: new Date(block.start), end: new Date(block.end) };
  const length = blockMinutes(span);
  const [partOpen, setPartOpen] = useState(false);
  const [worked, setWorked] = useState(block.suggestedWorkedMinutes);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(outcome: ReviewOutcome) {
    setError(null);
    startTransition(async () => {
      const result = await reviewBlock(block.id, outcome);
      if (result.ok) return;
      if ("notFound" in result) setError("This Block no longer exists.");
      else setError(result.errors.workedMinutes ?? result.errors.block ?? "Couldn't save this review.");
    });
  }

  return (
    <>
      <p className={styles.quote}>Did the work on {block.taskTitle} happen?</p>
      <div className={styles.footer}>
        <span>
          {formatSpan(span.start, span.end, timeZone)} ({formatDuration(length)}) ·
        </span>
        <span className={styles.actions}>
          <button type="button" className="link" disabled={pending} onClick={() => submit({ review: "done" })}>
            Done
          </button>
          {canBePartlyDone(span) && (
            <button
              type="button"
              className="link"
              disabled={pending}
              aria-expanded={partOpen}
              onClick={() => setPartOpen(!partOpen)}
            >
              Partly
            </button>
          )}
          <button type="button" className="link" disabled={pending} onClick={() => submit({ review: "not-done" })}>
            Not done
          </button>
        </span>
      </div>
      {partOpen && (
        <form
          className={styles.part}
          onSubmit={(e) => {
            e.preventDefault();
            submit({ review: "partial", workedMinutes: worked });
          }}
        >
          <label>
            Minutes worked
            <input
              type="number"
              min={15}
              max={length - 15}
              step={15}
              value={worked}
              onChange={(e) => setWorked(e.target.valueAsNumber)}
            />
          </label>
          <button type="submit" className="button" disabled={pending}>
            Save
          </button>
        </form>
      )}
      {error && <p className="field-error">{error}</p>}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { blockMinutes, canBePartlyDone, type ReviewOutcome } from "@/core/completion";
import { formatDuration } from "@/core/tasks";
import { reviewBlock } from "./actions";
import styles from "./unreviewed-banner.module.css";

export interface UnreviewedBlockProps {
  id: string;
  taskTitle: string;
  /** ISO instants */
  start: string;
  end: string;
  suggestedWorkedMinutes: number;
}

/** Lists the Unreviewed Blocks so the owner can say whether each one's work happened. */
export function UnreviewedBanner({ blocks, timeZone }: { blocks: UnreviewedBlockProps[]; timeZone: string }) {
  if (blocks.length === 0) return null;
  return (
    <section className={styles.banner} aria-labelledby="unreviewed-heading">
      <h2 id="unreviewed-heading">
        {blocks.length === 1 ? "1 Unreviewed Block" : `${blocks.length} Unreviewed Blocks`}
      </h2>
      <p className="muted">Did the work happen? Until you say, each Block counts as worked.</p>
      <ul className={styles.list}>
        {blocks.map((block) => (
          <UnreviewedBlockRow key={block.id} block={block} timeZone={timeZone} />
        ))}
      </ul>
    </section>
  );
}

function formatSpan(start: Date, end: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone });
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  return `${day.format(start)}, ${time.format(start)}–${time.format(end)}`;
}

function UnreviewedBlockRow({ block, timeZone }: { block: UnreviewedBlockProps; timeZone: string }) {
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
    <li className={styles.block}>
      <div>
        <span className={styles.title}>{block.taskTitle}</span>{" "}
        <span className="muted">
          {formatSpan(span.start, span.end, timeZone)} ({formatDuration(length)})
        </span>
      </div>
      <div className={styles.actions}>
        <button type="button" className="button" disabled={pending} onClick={() => submit({ review: "done" })}>
          Done
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={pending}
          onClick={() => submit({ review: "not-done" })}
        >
          Didn’t do it
        </button>
        {canBePartlyDone(span) && !partOpen && (
          <button type="button" className="button secondary" disabled={pending} onClick={() => setPartOpen(true)}>
            Did part of it
          </button>
        )}
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
            <button type="button" className="link" onClick={() => setPartOpen(false)}>
              Cancel
            </button>
          </form>
        )}
      </div>
      {error && <span className={`field-error ${styles.error}`}>{error}</span>}
    </li>
  );
}

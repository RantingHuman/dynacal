"use client";

import type { ReactNode } from "react";
import { LabelFrame } from "../schedule/floating-label";
import styles from "./modal-card.module.css";

/** Keeps Tab among a modal card's own controls, as nothing behind it can be used while it's up. */
function keepTabInside(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab") return;
  const controls = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
  const at = controls.indexOf(document.activeElement as HTMLElement);
  e.preventDefault();
  controls[(at + (e.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
}

/**
 * A card over a dimmed screen, which nothing behind can be used under, in the middle on the computer and low down on a
 * phone, where a thumb reaches. A tap outside it dismisses it; `overMessage` puts it over the message too, for a card
 * that asks about a change that's under way.
 */
export function ModalCard({
  role = "dialog",
  labelledBy,
  className,
  overMessage = false,
  onDismiss,
  children,
}: {
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  /** How wide it is, and how its contents are spaced. */
  className: string;
  overMessage?: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={styles.scrim}
      data-over-message={overMessage || undefined}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      onKeyDown={keepTabInside}
    >
      <LabelFrame className={`${styles.card} ${className}`} labelledBy={labelledBy}>
        {children}
      </LabelFrame>
    </div>
  );
}

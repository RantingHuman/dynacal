"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SetBusyOverrideResult } from "@/core/busy-override";
import type { RecalculateResult } from "@/core/commands";
import type { MoveBlockResult, UnpinBlockResult } from "@/core/pinning";
import { getRuntime } from "@/server/runtime";
import { requireOwner } from "@/server/session";

export async function recalculate(): Promise<RecalculateResult> {
  await requireOwner();
  const result = getRuntime().commands.recalculate();
  revalidatePath("/");
  return result;
}

const blockTimeSchema = z.strictObject({ start: z.iso.datetime(), end: z.iso.datetime() });

/** Moves or resizes a Block, making it a Pinned Block. Instants arrive as ISO strings. */
export async function moveBlock(id: string, to: unknown): Promise<MoveBlockResult> {
  await requireOwner();
  const { start, end } = blockTimeSchema.parse(to);
  const result = getRuntime().commands.moveBlock(z.string().parse(id), { start: new Date(start), end: new Date(end) });
  revalidatePath("/");
  return result;
}

const restoredTimeSchema = z.strictObject({ start: z.iso.datetime(), end: z.iso.datetime(), pinned: z.boolean() });

/** Undoes a move: puts a Block back at the time it left, pinned or not as it was. */
export async function restoreBlockTime(id: string, back: unknown): Promise<MoveBlockResult> {
  await requireOwner();
  const { start, end, pinned } = restoredTimeSchema.parse(back);
  const result = getRuntime().commands.restoreBlockTime(z.string().parse(id), { start: new Date(start), end: new Date(end), pinned });
  revalidatePath("/");
  return result;
}

const pinnedAgainSchema = z.strictObject({ id: z.string(), taskId: z.string(), start: z.iso.datetime(), end: z.iso.datetime() });

/** Undoes an Unpin: pins the Task at the time it left, if that time hasn't ended. */
export async function pinBlockAgain(back: unknown): Promise<MoveBlockResult> {
  await requireOwner();
  const { start, end, ...block } = pinnedAgainSchema.parse(back);
  const result = getRuntime().commands.pinBlockAgain({ ...block, start: new Date(start), end: new Date(end) });
  revalidatePath("/");
  return result;
}

export async function unpinBlock(id: string): Promise<UnpinBlockResult> {
  await requireOwner();
  const result = getRuntime().commands.unpinBlock(z.string().parse(id));
  revalidatePath("/");
  return result;
}

const eventRefSchema = z.strictObject({ calendarId: z.string(), eventId: z.string() });
const busyOverrideSchema = z.enum(["busy", "not-busy"]).nullable();

/** Sets an Event's Busy Override, or clears it with null, then recalculates. Nothing is written to Google. */
export async function setBusyOverride(event: unknown, override: unknown): Promise<SetBusyOverrideResult> {
  await requireOwner();
  const result = getRuntime().commands.setBusyOverride(eventRefSchema.parse(event), busyOverrideSchema.parse(override));
  revalidatePath("/");
  return result;
}

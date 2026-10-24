"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

const blockTimeSchema = z.object({ start: z.iso.datetime(), end: z.iso.datetime() });

/** Moves or resizes a Block, making it a Pinned Block. Instants arrive as ISO strings. */
export async function moveBlock(id: string, to: unknown): Promise<MoveBlockResult> {
  await requireOwner();
  const { start, end } = blockTimeSchema.parse(to);
  const result = getRuntime().commands.moveBlock(z.string().parse(id), { start: new Date(start), end: new Date(end) });
  revalidatePath("/");
  return result;
}

export async function unpinBlock(id: string): Promise<UnpinBlockResult> {
  await requireOwner();
  const result = getRuntime().commands.unpinBlock(z.string().parse(id));
  revalidatePath("/");
  return result;
}

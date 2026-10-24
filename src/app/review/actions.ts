"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ReviewBlockResult } from "@/core/completion";
import { getRuntime } from "@/server/runtime";
import { requireOwner } from "@/server/session";

const reviewOutcomeSchema = z.discriminatedUnion("review", [
  z.object({ review: z.literal("done") }),
  z.object({ review: z.literal("not-done") }),
  z.object({ review: z.literal("partial"), workedMinutes: z.number() }),
]);

export async function reviewBlock(id: string, outcome: unknown): Promise<ReviewBlockResult> {
  await requireOwner();
  const result = getRuntime().commands.reviewBlock(z.string().parse(id), reviewOutcomeSchema.parse(outcome));
  revalidatePath("/");
  return result;
}

"use server";

import { revalidatePath } from "next/cache";
import type { RecalculateResult } from "@/core/commands";
import { getRuntime } from "@/server/runtime";
import { requireOwner } from "@/server/session";

export async function recalculate(): Promise<RecalculateResult> {
  await requireOwner();
  const result = getRuntime().commands.recalculate();
  revalidatePath("/");
  return result;
}

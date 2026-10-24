"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CompleteTaskResult } from "@/core/commands";
import { PRIORITIES, type TaskResult, type UpdateTaskResult } from "@/core/tasks";
import { getRuntime } from "@/server/runtime";
import { requireOwner } from "@/server/session";

const dateOrDateTimeSchema = z.object({ date: z.string(), time: z.string().nullable() }).nullable();

const taskInputSchema = z.object({
  title: z.string(),
  notes: z.string(),
  estimatedMinutes: z.number(),
  deadline: dateOrDateTimeSchema,
  earliestStart: dateOrDateTimeSchema,
  priority: z.enum(PRIORITIES),
  dontSplit: z.boolean(),
});

export async function createTask(input: unknown): Promise<TaskResult> {
  await requireOwner();
  const result = getRuntime().commands.createTask(taskInputSchema.parse(input));
  revalidatePath("/");
  return result;
}

export async function updateTask(id: string, input: unknown): Promise<UpdateTaskResult> {
  await requireOwner();
  const result = getRuntime().commands.updateTask(z.string().parse(id), taskInputSchema.parse(input));
  revalidatePath("/");
  return result;
}

export async function deleteTask(id: string): Promise<void> {
  await requireOwner();
  getRuntime().commands.deleteTask(z.string().parse(id));
  revalidatePath("/");
}

export async function completeTask(id: string): Promise<CompleteTaskResult> {
  await requireOwner();
  const result = getRuntime().commands.completeTask(z.string().parse(id));
  revalidatePath("/");
  return result;
}

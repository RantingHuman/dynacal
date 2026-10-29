"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ClearDeclinedTimeResult, CompleteTaskResult } from "@/core/commands";
import type { CheckInResult } from "@/core/completion";
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
  splittable: z.boolean(),
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

export async function reopenTask(id: string): Promise<CompleteTaskResult> {
  await requireOwner();
  const result = getRuntime().commands.reopenTask(z.string().parse(id));
  revalidatePath("/");
  return result;
}

export async function allowSplitting(id: string): Promise<CompleteTaskResult> {
  await requireOwner();
  const result = getRuntime().commands.allowSplitting(z.string().parse(id));
  revalidatePath("/");
  return result;
}

const checkInAnswerSchema = z.discriminatedUnion("answer", [
  z.object({ answer: z.literal("finished") }),
  // The command refuses minutes that aren't a 15-minute step of at least 15, with a message.
  z.object({ answer: z.literal("more-time"), minutes: z.number() }),
  z.object({ answer: z.literal("didnt-start") }),
]);

export async function checkIn(blockId: string, answer: unknown): Promise<CheckInResult> {
  await requireOwner();
  const result = getRuntime().commands.checkIn(z.string().parse(blockId), checkInAnswerSchema.parse(answer));
  revalidatePath("/");
  return result;
}

export async function clearDeclinedTime(id: number): Promise<ClearDeclinedTimeResult> {
  await requireOwner();
  const result = getRuntime().commands.clearDeclinedTime(z.number().int().parse(id));
  revalidatePath("/");
  return result;
}

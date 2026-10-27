import { cp, realpath } from "node:fs/promises";

/** Materialize a possibly linked node_modules root while keeping pnpm's internal links intact. */
export async function copyDependencies(source, destination) {
  await cp(await realpath(source), destination, { recursive: true, verbatimSymlinks: true });
}

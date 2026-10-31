import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Mechanical rules from CODING_STANDARDS.md, checked here so a breach fails the tests, not a review.
const src = join(process.cwd(), "src");
const files = (readdirSync(src, { recursive: true }) as string[]).map((f) => join(src, f));

/** Every `pattern` match in the files `which` picks, as "path:line: text". */
function matches(which: (path: string) => boolean, pattern: RegExp): string[] {
  return files.filter(which).flatMap((path) =>
    readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, i) => (pattern.test(line) ? [`${relative(process.cwd(), path)}:${i + 1}: ${line.trim()}`] : [])),
  );
}

describe("repo rules", () => {
  // z.object drops fields it doesn't list without a word, which is how a Task's Context and Buffers were once
  // thrown away on save. Strict objects refuse them; a loose one says so where the browser adds fields of its own.
  it("server actions validate input with strict or loose objects, never z.object", () => {
    expect(matches((p) => p.endsWith("actions.ts"), /\bz\.object\(/)).toEqual([]);
  });
});

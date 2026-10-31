import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The mechanical rules CODING_STANDARDS.md leaves out, checked here so a breach fails the tests, not a review.
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
  // thrown away on save. Strict objects refuse them. Only the push subscription is loose, as the browser writes it.
  it("server actions validate input with strict objects", () => {
    const isAction = (path: string) => path.endsWith("actions.ts");
    expect(matches(isAction, /\bz\.object\(/)).toEqual([]);
    expect(matches((path) => isAction(path) && !path.endsWith("reminders/actions.ts"), /\bz\.looseObject\(/)).toEqual([]);
  });
});

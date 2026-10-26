import { render, type RenderOptions } from "@testing-library/react";
import { Profiler, type ReactNode } from "react";

/** More commits than any real interaction in one test makes: past this, something is updating itself forever. */
const MAX_COMMITS = 300;

/**
 * Renders like Testing Library's `render`, but fails fast on a render loop. React keeps such a loop busy without
 * yielding, so the test would otherwise hang (Vitest's timeout never gets a turn) instead of failing.
 */
export function renderGuarded(ui: ReactNode, options?: RenderOptions) {
  let commits = 0;
  const onRender = () => {
    commits += 1;
    if (commits > MAX_COMMITS) throw new Error(`Render loop: more than ${MAX_COMMITS} commits in one test`);
  };
  return render(
    <Profiler id="test" onRender={onRender}>
      {ui}
    </Profiler>,
    options,
  );
}

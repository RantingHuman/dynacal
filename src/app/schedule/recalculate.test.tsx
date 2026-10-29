// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recalculate } from "./actions";
import type { CalendarBlock } from "./calendar";
import { useRecalculate } from "./recalculate";

vi.mock("./actions", () => ({ recalculate: vi.fn() }));

function time(taskId: string, taskTitle: string, piece: number, hour: number): CalendarBlock {
  const start = `2026-10-27T${String(hour).padStart(2, "0")}:00:00.000Z`;
  const end = `2026-10-27T${String(hour + 1).padStart(2, "0")}:00:00.000Z`;
  return { id: `${taskId}-${piece}`, displayKey: `${taskId}#${piece}`, taskId, taskTitle, start, end, pinned: false };
}

/** Recalculates from `before`; the Schedule then comes back as `after`. Returns what was announced last. */
async function recalculateFrom(before: CalendarBlock[], after: CalendarBlock[]) {
  const announce = vi.fn();
  const { result, rerender } = renderHook(({ blocks }) => useRecalculate(blocks, announce), {
    initialProps: { blocks: before },
  });
  act(() => result.current.run());
  rerender({ blocks: after });
  await waitFor(() => expect(result.current.pending).toBe(false));
  return announce.mock.calls.at(-1)?.[0];
}

describe("what a Recalculation says it moved", () => {
  beforeEach(() => vi.mocked(recalculate).mockReset().mockResolvedValue({ ok: true }));

  it("names the one Task it moved", async () => {
    const before = [time("t1", "Pack for vegas", 1, 9), time("t2", "Board memo", 1, 11)];
    const after = [time("t1", "Pack for vegas", 1, 10), time("t2", "Board memo", 1, 11)];

    expect(await recalculateFrom(before, after)).toBe("Moved “Pack for vegas”");
  });

  it("counts Tasks, not their pieces", async () => {
    const before = [time("t1", "Pack for vegas", 1, 9), time("t1", "Pack for vegas", 2, 11), time("t2", "Board memo", 1, 13)];
    const after = [time("t1", "Pack for vegas", 1, 10), time("t1", "Pack for vegas", 2, 12), time("t2", "Board memo", 1, 14)];

    expect(await recalculateFrom(before, after)).toBe("Moved 2 Tasks");
  });
});

// @vitest-environment jsdom

import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { renderGuarded } from "../testing/render";
import { reviewBlock } from "./actions";
import { ReviewBox, type UnreviewedBlockProps } from "./review-box";

vi.mock("./actions", () => ({ reviewBlock: vi.fn() }));

const first: UnreviewedBlockProps = {
  id: "b1", taskTitle: "Write Q4 planning doc", start: "2026-10-27T10:00:00.000Z",
  end: "2026-10-27T11:00:00.000Z", suggestedWorkedMinutes: 30,
};
const second: UnreviewedBlockProps = { ...first, id: "b2", taskTitle: "Prepare launch" };
const box = (blocks: UnreviewedBlockProps[]) => <ReviewBox blocks={blocks} timeZone="Europe/London" />;

beforeEach(() => {
  vi.mocked(reviewBlock).mockReset();
  vi.mocked(reviewBlock).mockResolvedValue({ ok: true });
});
afterEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: true }));

describe("reviewing Blocks", () => {
  it.each([
    ["Done", { review: "done" }],
    ["Not done", { review: "not-done" }],
  ] as const)("records %s for the visible Block", async (label, outcome) => {
    renderGuarded(box([first]));
    expect(screen.getByText("Did the work on Write Q4 planning doc happen?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(reviewBlock).toHaveBeenCalledWith("b1", outcome));
  });

  it("records the minutes worked when a Block was partly done", async () => {
    renderGuarded(box([first]));
    await userEvent.click(screen.getByRole("button", { name: "Partly" }));
    const minutes = screen.getByRole("spinbutton", { name: "Minutes worked" });
    expect(minutes).toHaveProperty("value", "30");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "45");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(reviewBlock).toHaveBeenCalledWith("b1", { review: "partial", workedMinutes: 45 }));
  });

  it("does not submit a partial review when minutes are cleared", async () => {
    renderGuarded(box([first]));
    await userEvent.click(screen.getByRole("button", { name: "Partly" }));
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Minutes worked" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(reviewBlock).not.toHaveBeenCalled();
  });

  it("pages between Blocks and submits the selected Block", async () => {
    renderGuarded(box([first, second]));
    expect(screen.getByText("1 of 2 to review")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous Unreviewed Block" })).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByRole("button", { name: "Next Unreviewed Block" }));
    expect(screen.getByText("Did the work on Prepare launch happen?")).toBeTruthy();
    expect(screen.getByText("2 of 2 to review")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next Unreviewed Block" })).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(reviewBlock).toHaveBeenCalledWith("b2", { review: "done" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous Unreviewed Block" }));
    expect(screen.getByText("Did the work on Write Q4 planning doc happen?")).toBeTruthy();
  });

  it("shows All caught up when the last reviewed Block leaves the list", async () => {
    function RefreshedReview() {
      const [blocks, setBlocks] = useState([first]);
      return <>{box(blocks)}<button onClick={() => setBlocks([])}>Refresh reviews</button></>;
    }
    renderGuarded(<RefreshedReview />);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(reviewBlock).toHaveBeenCalledWith("b1", { review: "done" }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh reviews" }));
    expect(screen.getByRole("status").textContent).toBe("All caught up.");
  });

  it("keeps the question and explains when a review is refused", async () => {
    vi.mocked(reviewBlock).mockResolvedValue({ ok: false, notFound: true });
    renderGuarded(box([first]));
    await userEvent.click(screen.getByRole("button", { name: "Not done" }));
    expect(await screen.findByText("This Block no longer exists.")).toBeTruthy();
    expect(screen.getByText("Did the work on Write Q4 planning doc happen?")).toBeTruthy();
  });

  it("shows a refused partial review's reason", async () => {
    vi.mocked(reviewBlock).mockResolvedValue({ ok: false, errors: { workedMinutes: "Choose a valid number of minutes." } });
    renderGuarded(box([first]));
    await userEvent.click(screen.getByRole("button", { name: "Partly" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Choose a valid number of minutes.")).toBeTruthy();
  });

  it("disables every review action when offline, including an open partial form", async () => {
    renderGuarded(box([first]));
    await userEvent.click(screen.getByRole("button", { name: "Partly" }));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event("offline")));
    for (const name of ["Done", "Partly", "Not done", "Save"]) {
      expect(screen.getByRole("button", { name })).toHaveProperty("disabled", true);
    }
    expect(reviewBlock).not.toHaveBeenCalled();
  });
});

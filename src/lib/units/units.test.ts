import { describe, expect, it } from "vitest";
import { nextSortOrder } from "./units";

describe("nextSortOrder", () => {
  it("starts at 0 when there are no units", () => {
    expect(nextSortOrder([])).toBe(0);
  });

  it("returns max sort_order + 1", () => {
    expect(
      nextSortOrder([
        { sort_order: 0 },
        { sort_order: 2 },
        { sort_order: 1 },
      ]),
    ).toBe(3);
  });
});

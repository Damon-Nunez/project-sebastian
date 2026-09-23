import { describe, expect, it } from "vitest";
import { headerTextForMatch } from "./headerText";

describe("headerTextForMatch", () => {
  it("returns the full body when short", () => {
    expect(headerTextForMatch("Damon Nunez\nPeriod 3")).toBe(
      "Damon Nunez\nPeriod 3",
    );
  });

  it("trims and caps long bodies", () => {
    const body = `Name: Damon\n${"x".repeat(2000)}`;
    const header = headerTextForMatch(body, 20);
    expect(header.length).toBe(20);
    expect(header.startsWith("Name: Damon")).toBe(true);
  });
});

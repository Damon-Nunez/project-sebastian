import { describe, expect, it } from "vitest";
import {
  gradedAgainstOlderKey,
  parseGradeDetail,
  stripAnswerMarkers,
} from "./results";

describe("parseGradeDetail", () => {
  it("accepts version 1 detail and rejects anything else", () => {
    const detail = { version: 1, items: [], categoryScores: [], percent: 88 };
    expect(parseGradeDetail(detail)).toEqual(detail);
    expect(parseGradeDetail({ ...detail, version: 2 })).toBeNull();
    expect(parseGradeDetail({ version: 1 })).toBeNull();
    expect(parseGradeDetail(null)).toBeNull();
  });
});

describe("stripAnswerMarkers", () => {
  it("removes formatting markers but keeps the words", () => {
    expect(stripAnswerMarkers("B) [[hl]]ashamed[[/hl]] [[s]]C)[[/s]]")).toBe(
      "B) ashamed C)",
    );
  });
});

describe("gradedAgainstOlderKey", () => {
  it("flags grades made before the key changed", () => {
    expect(
      gradedAgainstOlderKey("2026-10-01T10:00:00+00:00", "2026-10-01T11:00:00Z"),
    ).toBe(true);
    expect(
      gradedAgainstOlderKey("2026-10-01T11:00:00+00:00", "2026-10-01T11:00:00Z"),
    ).toBe(false);
    expect(gradedAgainstOlderKey(null, "2026-10-01T11:00:00Z")).toBe(false);
  });
});

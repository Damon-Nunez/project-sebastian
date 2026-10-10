import { describe, expect, it } from "vitest";
import {
  defaultCommentForSuggestion,
  defaultGradeForSuggestion,
  midpointGrade,
  parseTeacherGrade,
} from "./finalize";

describe("parseTeacherGrade", () => {
  it("accepts 0–100 with optional one decimal", () => {
    expect(parseTeacherGrade("80")).toBe(80);
    expect(parseTeacherGrade("80.5")).toBe(80.5);
    expect(parseTeacherGrade("0")).toBe(0);
    expect(parseTeacherGrade("100")).toBe(100);
  });

  it("rejects blank and out-of-range values", () => {
    expect(parseTeacherGrade("")).toBeNull();
    expect(parseTeacherGrade("  ")).toBeNull();
    expect(parseTeacherGrade("101")).toBeNull();
    expect(parseTeacherGrade("-1")).toBeNull();
    expect(parseTeacherGrade("eighty")).toBeNull();
    expect(parseTeacherGrade("80.55")).toBeNull();
  });
});

describe("midpointGrade / defaults", () => {
  it("rounds the AI range midpoint", () => {
    expect(midpointGrade(78, 83)).toBe(81);
    expect(midpointGrade(null, 83)).toBeNull();
  });

  it("prefers teacher_grade, then midpoint", () => {
    expect(
      defaultGradeForSuggestion({
        teacher_grade: 90,
        suggested_range_low: 78,
        suggested_range_high: 83,
      }),
    ).toBe(90);
    expect(
      defaultGradeForSuggestion({
        teacher_grade: null,
        suggested_range_low: 78,
        suggested_range_high: 83,
      }),
    ).toBe(81);
  });

  it("prefers teacher_comment over suggested", () => {
    expect(
      defaultCommentForSuggestion({
        teacher_comment: "Mine",
        suggested_comment: "AI",
      }),
    ).toBe("Mine");
    expect(
      defaultCommentForSuggestion({
        teacher_comment: null,
        suggested_comment: "AI",
      }),
    ).toBe("AI");
  });
});

import { describe, expect, it } from "vitest";
import { classworkHomeworkCriteriaFixture } from "@/lib/rubrics/criteria";
import { aiGradeSchema, rubricIssues, type AiGrade, type GradedItem } from "./gradeSchema";
import { computeGrade, levelPercent } from "./score";

const criteria = classworkHomeworkCriteriaFixture();

function item(overrides: Partial<GradedItem>): GradedItem {
  return {
    label: "1",
    kind: "key",
    studentAnswer: "B",
    expectedAnswer: "B",
    verdict: "correct",
    rubricLevel: null,
    maxPoints: null,
    reason: "Matches the key.",
    ...overrides,
  };
}

function grade(items: GradedItem[], levels = [3, 3, 3]): AiGrade {
  return {
    items,
    categoryScores: criteria.categories.map((category, i) => ({
      categoryId: category.id,
      level: levels[i]!,
      reason: "ok",
    })),
    comment: "Solid work.",
    accommodationConsidered: false,
    accommodationNote: null,
  };
}

describe("levelPercent", () => {
  it("uses the 4/3/2/1 → 95/85/75/65 default table", () => {
    expect([4, 3, 2, 1].map((l) => levelPercent(l, criteria.scale))).toEqual([
      95, 85, 75, 65,
    ]);
  });

  it("uses the rubric's percent hints when set", () => {
    const scale = { ...criteria.scale, percentMin: 50, percentMax: 100 };
    expect(levelPercent(4, scale)).toBe(100);
    expect(levelPercent(1, scale)).toBe(50);
  });
});

describe("computeGrade", () => {
  it("sums stated points with ½ credit for partial answers", () => {
    const items = [
      ...Array.from({ length: 7 }, (_, i) => item({ label: `${i + 1}`, maxPoints: 1 })),
      item({ label: "8", verdict: "incorrect", maxPoints: 1 }),
      item({
        label: "9",
        kind: "rubric",
        verdict: null,
        rubricLevel: 4,
        maxPoints: 1,
      }),
      item({
        label: "10",
        verdict: "partial",
        maxPoints: 1,
        reason: "Correct claim, but no quote from the text.",
      }),
    ];
    const result = computeGrade({ grade: grade(items), criteria, hasReference: true });
    expect(result.mode).toBe("points");
    expect(result.earnedPoints).toBeCloseTo(8.45);
    expect(result.rangeLow).toBe(83);
    expect(result.rangeHigh).toBe(87);
  });

  it("falls back to the daily rubric when any question has no points", () => {
    const items = [item({ maxPoints: 2 }), item({ label: "2", maxPoints: null })];
    const result = computeGrade({
      grade: grade(items, [4, 3, 2]),
      criteria,
      hasReference: true,
    });
    expect(result).toMatchObject({ mode: "rubric", percent: 85, rangeLow: 83, rangeHigh: 87 });
  });

  it("uses the rubric when there's no reference, even if points were listed", () => {
    const result = computeGrade({
      grade: grade([item({ maxPoints: 5 })]),
      criteria,
      hasReference: false,
    });
    expect(result.mode).toBe("rubric");
  });

  it("widens the top of the range for unreadable answers", () => {
    const items = [
      item({ maxPoints: 5 }),
      item({ label: "2", maxPoints: 5, verdict: "unreadable", reason: "Two options highlighted." }),
    ];
    const result = computeGrade({ grade: grade(items), criteria, hasReference: true });
    expect(result.rangeLow).toBe(48);
    expect(result.rangeHigh).toBe(100);
  });
});

describe("aiGradeSchema", () => {
  it("rejects partial credit without a specific reason", () => {
    const bad = grade([item({ verdict: "partial", reason: "partial" })]);
    expect(aiGradeSchema.safeParse(bad).success).toBe(false);
    const good = grade([
      item({ verdict: "partial", reason: "Right idea, no evidence from the text." }),
    ]);
    expect(aiGradeSchema.safeParse(good).success).toBe(true);
  });

  it("flags missing categories and off-rubric levels", () => {
    const g = grade([]);
    g.categoryScores = [{ categoryId: "completeness", level: 7, reason: "x" }];
    expect(rubricIssues(g, criteria)).toEqual([
      "completeness: level 7 is not on the rubric",
      "missing category understanding",
      "missing category mechanics",
    ]);
  });
});

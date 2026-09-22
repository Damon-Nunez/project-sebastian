import { describe, expect, it } from "vitest";
import {
  classworkHomeworkCriteriaFixture,
  emptyRubricCriteria,
  isRubricCriteriaComplete,
  parseRubricCriteria,
  safeParseRubricCriteria,
} from "./criteria";

describe("rubricCriteriaSchema", () => {
  it("accepts the classwork/homework hybrid fixture", () => {
    const fixture = classworkHomeworkCriteriaFixture();
    const parsed = parseRubricCriteria(fixture);
    expect(parsed.version).toBe(1);
    expect(parsed.levels).toHaveLength(4);
    expect(parsed.categories).toHaveLength(3);
    expect(parsed.cells).toHaveLength(12);
    expect(isRubricCriteriaComplete(parsed)).toBe(true);
  });

  it("accepts empty grid with blank descriptors (draft setup)", () => {
    const draft = emptyRubricCriteria({
      categoryNames: ["Completeness", "Understanding"],
    });
    const parsed = parseRubricCriteria(draft);
    expect(parsed.cells).toHaveLength(8);
    expect(isRubricCriteriaComplete(parsed)).toBe(false);
  });

  it("rejects missing category×level cells", () => {
    const fixture = classworkHomeworkCriteriaFixture();
    const broken = {
      ...fixture,
      cells: fixture.cells.slice(0, 3),
    };
    const result = safeParseRubricCriteria(broken);
    expect(result.success).toBe(false);
  });

  it("rejects unknown categoryId on a cell", () => {
    const fixture = classworkHomeworkCriteriaFixture();
    const broken = {
      ...fixture,
      cells: [
        ...fixture.cells.slice(1),
        {
          categoryId: "not-a-real-category",
          levelId: "level-4",
          description: "oops",
        },
      ],
    };
    const result = safeParseRubricCriteria(broken);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate level ids", () => {
    const fixture = classworkHomeworkCriteriaFixture();
    const broken = {
      ...fixture,
      levels: [
        ...fixture.levels.slice(0, 3),
        { id: "level-4", score: 1, label: "dup" },
      ],
    };
    const result = safeParseRubricCriteria(broken);
    expect(result.success).toBe(false);
  });

  it("allows optional weights and percent scale hints", () => {
    const fixture = classworkHomeworkCriteriaFixture();
    const withWeights = {
      ...fixture,
      scale: { ...fixture.scale, percentMin: 0, percentMax: 100 },
      categories: fixture.categories.map((c, i) => ({
        ...c,
        weight: i === 0 ? 50 : i === 1 ? 30 : 20,
      })),
    };
    const parsed = parseRubricCriteria(withWeights);
    expect(parsed.scale.percentMax).toBe(100);
    expect(parsed.categories.map((c) => c.weight)).toEqual([50, 30, 20]);
  });
});

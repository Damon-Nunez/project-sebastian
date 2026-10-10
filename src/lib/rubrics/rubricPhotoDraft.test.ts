import { describe, expect, it } from "vitest";
import { rubricCriteriaFromPhotoDraft } from "./rubricPhotoDraft";

const fourPoint = {
  name: "Classwork / Homework",
  levels: [
    { score: 1, label: "Does not meet" },
    { score: 4, label: "Exceeds" },
    { score: 3, label: "Meets" },
    { score: 2, label: "Approaching" },
    { score: 4, label: "duplicate dropped" },
  ],
  categories: [
    {
      name: "Completeness",
      weight: "25",
      descriptors: {
        "4": "Thorough",
        "3": "Done",
        "2": "Partial",
        "1": "Incomplete",
      },
    },
    {
      name: "  ",
      descriptors: { "4": "skip blank name" },
    },
    {
      name: "Mechanics",
      weight: null,
      descriptors: { "4.0": "Few errors" },
    },
  ],
};

describe("rubricCriteriaFromPhotoDraft", () => {
  it("builds a reviewable grid with high scores first", () => {
    const { name, criteria } = rubricCriteriaFromPhotoDraft(fourPoint);
    expect(name).toBe("Classwork / Homework");
    expect(criteria.levels.map((level) => level.score)).toEqual([4, 3, 2, 1]);
    expect(criteria.levels[0]?.label).toBe("Exceeds");
    expect(criteria.categories.map((category) => category.name)).toEqual([
      "Completeness",
      "Mechanics",
    ]);
    expect(criteria.categories[0]?.weight).toBe(25);
    expect(criteria.categories[1]?.weight).toBeNull();
    expect(criteria.scale).toEqual({
      min: 1,
      max: 4,
      percentMin: null,
      percentMax: null,
    });
    const completeness = criteria.categories[0]!;
    const exceeds = criteria.levels[0]!;
    const mechanicsCell = criteria.cells.find(
      (cell) =>
        cell.categoryId === criteria.categories[1]?.id &&
        cell.levelId === exceeds.id,
    );
    const completeCell = criteria.cells.find(
      (cell) =>
        cell.categoryId === completeness.id && cell.levelId === exceeds.id,
    );
    expect(completeCell?.description).toBe("Thorough");
    expect(mechanicsCell?.description).toBe("Few errors");
    expect(criteria.cells).toHaveLength(8);
  });

  it("leaves a missing descriptor blank for the teacher to fill", () => {
    const { criteria } = rubricCriteriaFromPhotoDraft({
      levels: [{ score: 2, label: "Ok" }],
      categories: [{ name: "Ideas", descriptors: {} }],
    });
    expect(criteria.cells[0]?.description).toBe("");
  });

  it("rejects a payload with no categories", () => {
    expect(() =>
      rubricCriteriaFromPhotoDraft({ levels: [{ score: 4, label: "A" }] }),
    ).toThrow(/clearer photo/);
  });
});

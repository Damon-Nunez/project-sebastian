import { describe, expect, it } from "vitest";
import { buildPeriodsWithRosters } from "./periodRosters";

describe("buildPeriodsWithRosters", () => {
  it("groups students under matching periods and keeps period order", () => {
    const result = buildPeriodsWithRosters(
      [
        {
          id: "p-geo",
          name: "Georgetown",
          school_year: "2025-26",
        },
        {
          id: "p-how",
          name: "Howard",
          school_year: null,
        },
        {
          id: "p-pri",
          name: "Princeton",
          school_year: "2025-26",
        },
      ],
      [
        {
          id: "s1",
          name: "Ada",
          nickname: null,
          section_id: "p-geo",
        },
        {
          id: "s2",
          name: "Ben",
          nickname: "Benny",
          section_id: "p-pri",
        },
        {
          id: "s3",
          name: "Cara",
          nickname: null,
          section_id: "p-geo",
        },
      ],
    );

    expect(result.map((p) => p.name)).toEqual([
      "Georgetown",
      "Howard",
      "Princeton",
    ]);
    expect(result[0]?.students.map((s) => s.name)).toEqual(["Ada", "Cara"]);
    expect(result[1]?.students).toEqual([]);
    expect(result[2]?.students).toEqual([
      { id: "s2", name: "Ben", nickname: "Benny" },
    ]);
    expect(result[0]?.schoolYear).toBe("2025-26");
    expect(result[1]?.schoolYear).toBeNull();
  });
});

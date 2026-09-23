import { describe, expect, it } from "vitest";
import type { PeriodWithRoster } from "@/lib/roster/periods";
import {
  flattenRosterForMatch,
  matchHomeworkToRoster,
} from "./matchHomework";

const princeton: PeriodWithRoster = {
  id: "p-princeton",
  name: "Princeton",
  schoolYear: "2025-26",
  students: [
    { id: "s-damon", name: "Damon Nunez", nickname: null },
    { id: "s-maria", name: "Maria Garcia", nickname: null },
  ],
};

const period2: PeriodWithRoster = {
  id: "p-2",
  name: "Period 2",
  schoolYear: "2025-26",
  students: [
    { id: "s-jordan", name: "Jordan Lee", nickname: null },
    { id: "s-anna", name: "Anna Smith", nickname: null },
  ],
};

const periods = [princeton, period2];

describe("flattenRosterForMatch", () => {
  it("keeps each student attached to their period", () => {
    const flat = flattenRosterForMatch(periods);
    expect(flat).toHaveLength(4);
    expect(flat.find((s) => s.id === "s-damon")).toMatchObject({
      periodId: "p-princeton",
      periodName: "Princeton",
    });
  });
});

describe("matchHomeworkToRoster", () => {
  it("matches a unique student and their period from the filename", () => {
    expect(
      matchHomeworkToRoster(periods, {
        filename: "Nunez_Damon_U1L1M1.docx",
      }),
    ).toEqual({
      status: "matched",
      student: {
        studentId: "s-damon",
        studentName: "Damon Nunez",
        periodId: "p-princeton",
        periodName: "Princeton",
      },
    });
  });

  it("matches from header text when the filename has no name", () => {
    expect(
      matchHomeworkToRoster(periods, {
        filename: "homework.pdf",
        headerText: "Name: Jordan Lee\nPeriod 2",
      }),
    ).toEqual({
      status: "matched",
      student: {
        studentId: "s-jordan",
        studentName: "Jordan Lee",
        periodId: "p-2",
        periodName: "Period 2",
      },
    });
  });

  it("returns none when no roster name appears", () => {
    expect(
      matchHomeworkToRoster(periods, { filename: "period2_hw.docx" }),
    ).toEqual({ status: "none" });
  });

  it("returns ambiguous when two students from different periods hit", () => {
    const result = matchHomeworkToRoster(periods, {
      filename: "Damon_Nunez_and_Jordan_Lee_peer_review.pdf",
    });
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((c) => c.studentId).sort()).toEqual([
        "s-damon",
        "s-jordan",
      ]);
    }
  });

  it("returns none on an empty roster", () => {
    expect(
      matchHomeworkToRoster([], { filename: "Damon_Nunez.docx" }),
    ).toEqual({ status: "none" });
  });
});

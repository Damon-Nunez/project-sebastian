import { describe, expect, it } from "vitest";
import {
  evaluateSetup,
  isSetupWorkPath,
  type SetupSnapshot,
} from "./progress";

function snapshot(partial: Partial<SetupSnapshot> = {}): SetupSnapshot {
  return {
    displayName: "Ada George",
    honorific: "Ms",
    subject: "English Language Arts (ELA)",
    gradeLabel: "8th Grade",
    studentCount: 1,
    dailyRubricComplete: true,
    setupCompletedAt: null,
    ...partial,
  };
}

describe("evaluateSetup", () => {
  it("requires name, honorific, subject, and grade", () => {
    expect(evaluateSetup(snapshot({ honorific: "  " })).profileReady).toBe(
      false,
    );
    expect(evaluateSetup(snapshot()).profileReady).toBe(true);
  });

  it("requires a student and a complete daily rubric before enter-app", () => {
    expect(evaluateSetup(snapshot({ studentCount: 0 })).minimumMet).toBe(
      false,
    );
    expect(
      evaluateSetup(snapshot({ dailyRubricComplete: false })).minimumMet,
    ).toBe(false);
    expect(evaluateSetup(snapshot()).minimumMet).toBe(true);
  });

  it("stays unfinished until the timestamp is set", () => {
    expect(evaluateSetup(snapshot()).finished).toBe(false);
    expect(
      evaluateSetup(snapshot({ setupCompletedAt: "2026-10-10T00:00:00Z" }))
        .finished,
    ).toBe(true);
  });

  it("stays finished even if the roster is later empty", () => {
    const result = evaluateSetup(
      snapshot({
        studentCount: 0,
        setupCompletedAt: "2026-10-10T00:00:00Z",
      }),
    );
    expect(result.finished).toBe(true);
    expect(result.minimumMet).toBe(false);
  });
});

describe("isSetupWorkPath", () => {
  it("allows the checklist and the screens it links to", () => {
    expect(isSetupWorkPath("/setup")).toBe(true);
    expect(isSetupWorkPath("/periods/abc")).toBe(true);
    expect(isSetupWorkPath("/rubrics/daily")).toBe(true);
    expect(isSetupWorkPath("/units/u1/rubrics/new")).toBe(true);
    expect(isSetupWorkPath("/grading")).toBe(false);
    expect(isSetupWorkPath("/lessons")).toBe(false);
    expect(isSetupWorkPath("/")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_LESSON_TIME_FRAME,
  formatTeacherLine,
  lastNameFromDisplayName,
  teacherHeaderDefaults,
} from "./teacherHeader";

describe("teacherHeader", () => {
  it("takes the last name token from display name", () => {
    expect(lastNameFromDisplayName("Damon Nunez")).toBe("Nunez");
    expect(lastNameFromDisplayName("Ms George")).toBe("George");
    expect(lastNameFromDisplayName("")).toBe("");
  });

  it("formats honorific + last name without guessing gender", () => {
    expect(formatTeacherLine("Mr", "Damon Nunez")).toBe("Mr Nunez");
    expect(formatTeacherLine("Ms", "Ada George")).toBe("Ms George");
    expect(formatTeacherLine("", "Ada George")).toBe("Ada George");
  });

  it("builds profile defaults with the class-period time frame", () => {
    expect(
      teacherHeaderDefaults({
        subject: "English Language Arts (ELA)",
        grade_label: "8th Grade",
        honorific: "Mr",
        display_name: "Damon Nunez",
      }),
    ).toEqual({
      subject: "English Language Arts (ELA)",
      gradeLabel: "8th Grade",
      teacherLine: "Mr Nunez",
      timeFrame: DEFAULT_LESSON_TIME_FRAME,
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  coreSubjectOrEmpty,
  DEFAULT_LESSON_TIME_FRAME,
  formatTeacherLine,
  gradeBandOrEmpty,
  lastNameFromDisplayName,
  teacherHeaderDefaults,
} from "./teacherHeader";

describe("welcome dropdowns", () => {
  it("maps older subject text onto the four core subjects", () => {
    expect(coreSubjectOrEmpty("English Language Arts (ELA)")).toBe("ELA");
    expect(coreSubjectOrEmpty("Science")).toBe("Science");
    expect(coreSubjectOrEmpty("Art")).toBe("");
  });

  it("maps older grade text onto K through 12", () => {
    expect(gradeBandOrEmpty("8th Grade")).toBe("8");
    expect(gradeBandOrEmpty("Kindergarten")).toBe("K");
    expect(gradeBandOrEmpty("12")).toBe("12");
    expect(gradeBandOrEmpty("13th Grade")).toBe("");
  });
});

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

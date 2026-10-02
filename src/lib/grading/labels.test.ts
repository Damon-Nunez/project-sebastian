import { describe, expect, it } from "vitest";
import {
  assignmentFolderKey,
  assignmentFolderLabelsEqual,
  findSessionByFolderLabels,
  formatAssignmentFolderTitle,
  hasAssignmentFolderPath,
  normalizeAssignmentFolderLabels,
  normalizeFolderLabel,
} from "./labels";

describe("normalizeFolderLabel", () => {
  it("trims and nulls empty", () => {
    expect(normalizeFolderLabel("  1  ")).toBe("1");
    expect(normalizeFolderLabel("   ")).toBeNull();
    expect(normalizeFolderLabel(null)).toBeNull();
  });
});

describe("normalizeAssignmentFolderLabels", () => {
  it("normalizes each field", () => {
    expect(
      normalizeAssignmentFolderLabels({
        moduleLabel: " 1 ",
        unitLabel: "",
        lessonLabel: "2",
      }),
    ).toEqual({
      module_label: "1",
      unit_label: null,
      lesson_label: "2",
    });
  });
});

describe("hasAssignmentFolderPath", () => {
  it("is true when any label is set", () => {
    expect(
      hasAssignmentFolderPath({
        module_label: "1",
        unit_label: null,
        lesson_label: null,
      }),
    ).toBe(true);
    expect(
      hasAssignmentFolderPath({
        module_label: null,
        unit_label: null,
        lesson_label: null,
      }),
    ).toBe(false);
  });
});

describe("formatAssignmentFolderTitle", () => {
  it("builds M1U1L1-HW", () => {
    expect(
      formatAssignmentFolderTitle(
        {
          module_label: "1",
          unit_label: "1",
          lesson_label: "1",
        },
        null,
        "hw",
      ),
    ).toBe("M1U1L1-HW");
  });

  it("uses CW for short response", () => {
    expect(
      formatAssignmentFolderTitle(
        {
          module_label: "2",
          unit_label: "3",
          lesson_label: "4",
        },
        null,
        "short_response",
      ),
    ).toBe("M2U3L4-CW");
  });

  it("omits missing MUL parts", () => {
    expect(
      formatAssignmentFolderTitle(
        {
          module_label: "1",
          unit_label: null,
          lesson_label: "7",
        },
        null,
        "hw",
      ),
    ).toBe("M1L7-HW");
  });

  it("optional title wins over M/U/L", () => {
    expect(
      formatAssignmentFolderTitle(
        {
          module_label: "1",
          unit_label: "1",
          lesson_label: "1",
        },
        "Mango Ch1",
        "hw",
      ),
    ).toBe("Mango Ch1");
  });

  it("falls back to Untitled-HW when nothing is set", () => {
    expect(
      formatAssignmentFolderTitle({
        module_label: null,
        unit_label: null,
        lesson_label: null,
      }),
    ).toBe("Untitled-HW");
  });
});

describe("assignmentFolderKey / equal", () => {
  it("treats matching M/U/L as equal", () => {
    const a = {
      module_label: "1",
      unit_label: "1",
      lesson_label: "1",
    };
    const b = {
      module_label: "1",
      unit_label: "1",
      lesson_label: "1",
    };
    expect(assignmentFolderKey(a)).toBe("1|1|1");
    expect(assignmentFolderLabelsEqual(a, b)).toBe(true);
    expect(
      assignmentFolderLabelsEqual(a, {
        module_label: "1",
        unit_label: "2",
        lesson_label: "1",
      }),
    ).toBe(false);
  });
});

describe("findSessionByFolderLabels", () => {
  const sessions = [
    {
      id: "a",
      assignment_type: "hw",
      module_label: "1",
      unit_label: "1",
      lesson_label: "1",
    },
    {
      id: "b",
      assignment_type: "hw",
      module_label: "1",
      unit_label: "1",
      lesson_label: "2",
    },
    {
      id: "c",
      assignment_type: "essay",
      module_label: "1",
      unit_label: "1",
      lesson_label: "1",
    },
  ];

  it("finds the matching period assignment folder", () => {
    const hit = findSessionByFolderLabels(
      sessions,
      { module_label: "1", unit_label: "1", lesson_label: "1" },
      "hw",
    );
    expect(hit?.id).toBe("a");
  });

  it("ignores different assignment types", () => {
    const hit = findSessionByFolderLabels(
      sessions,
      { module_label: "1", unit_label: "1", lesson_label: "1" },
      "short_response",
    );
    expect(hit).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { classworkHomeworkCriteriaFixture } from "./criteria";
import {
  isRubricEditorDirty,
  rubricEditorSnapshot,
  rubricLeaveHref,
} from "./unsavedRubricLeave";

const currentUrl = "https://sebastian.test/rubrics/daily";

describe("isRubricEditorDirty", () => {
  it("is clean until the name or grid differs from the saved snapshot", () => {
    const criteria = classworkHomeworkCriteriaFixture();
    const saved = rubricEditorSnapshot("Classwork / Homework", criteria);

    expect(isRubricEditorDirty(saved, "Classwork / Homework", criteria)).toBe(
      false,
    );
    expect(isRubricEditorDirty(saved, "  Classwork / Homework  ", criteria)).toBe(
      false,
    );
    expect(isRubricEditorDirty(saved, "Homework", criteria)).toBe(true);

    const edited = structuredClone(criteria);
    edited.cells[0] = { ...edited.cells[0], description: "Changed descriptor" };
    expect(isRubricEditorDirty(saved, "Classwork / Homework", edited)).toBe(
      true,
    );
  });
});

describe("rubricLeaveHref", () => {
  it("holds in-app back and nav links", () => {
    expect(
      rubricLeaveHref({
        href: "/rubrics",
        currentUrl,
        target: null,
        hasDownload: false,
        modifiedClick: false,
      }),
    ).toBe("/rubrics");
  });

  it("lets same-page, new-tab, and modified clicks through", () => {
    expect(
      rubricLeaveHref({
        href: "/rubrics/daily",
        currentUrl,
        target: null,
        hasDownload: false,
        modifiedClick: false,
      }),
    ).toBeNull();
    expect(
      rubricLeaveHref({
        href: "/rubrics",
        currentUrl,
        target: "_blank",
        hasDownload: false,
        modifiedClick: false,
      }),
    ).toBeNull();
    expect(
      rubricLeaveHref({
        href: "/periods",
        currentUrl,
        target: null,
        hasDownload: false,
        modifiedClick: true,
      }),
    ).toBeNull();
  });
});

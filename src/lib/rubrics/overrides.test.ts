import { describe, expect, it } from "vitest";
import {
  pickSectionDailyEditorSource,
  sectionHasDailyOverride,
} from "./overrides";
import type { RubricRow } from "@/lib/db/types";

function stub(
  partial: Partial<RubricRow> & Pick<RubricRow, "id" | "kind">,
): RubricRow {
  return {
    teacher_id: "t1",
    name: "Daily",
    criteria: {},
    unit_id: null,
    section_id: "sec-1",
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("section daily overrides", () => {
  it("detects when a section override exists", () => {
    expect(
      sectionHasDailyOverride({
        hw: stub({ id: "1", kind: "hw" }),
        shortResponse: null,
      }),
    ).toBe(true);
    expect(
      sectionHasDailyOverride({ hw: null, shortResponse: null }),
    ).toBe(false);
  });

  it("prefers hw row as editor source", () => {
    const hw = stub({ id: "hw", kind: "hw" });
    const sr = stub({ id: "sr", kind: "short_response" });
    expect(pickSectionDailyEditorSource({ hw, shortResponse: sr })?.id).toBe(
      "hw",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  dailyWorkKindsToSync,
  pickDailyWorkEditorSource,
} from "./defaults";
import type { RubricRow } from "@/lib/db/types";

function stubRubric(partial: Partial<RubricRow> & Pick<RubricRow, "id" | "kind">): RubricRow {
  return {
    teacher_id: "t1",
    name: "Daily",
    criteria: {},
    unit_id: null,
    section_id: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("dailyWorkKindsToSync", () => {
  it("keeps hw and short_response paired for Approach B", () => {
    expect(dailyWorkKindsToSync()).toEqual(["hw", "short_response"]);
  });
});

describe("pickDailyWorkEditorSource", () => {
  it("prefers the hw row when both exist", () => {
    const hw = stubRubric({ id: "hw-1", kind: "hw" });
    const shortResponse = stubRubric({
      id: "sr-1",
      kind: "short_response",
    });
    expect(pickDailyWorkEditorSource({ hw, shortResponse })?.id).toBe("hw-1");
  });

  it("falls back to short_response when hw is missing", () => {
    const shortResponse = stubRubric({
      id: "sr-1",
      kind: "short_response",
    });
    expect(
      pickDailyWorkEditorSource({ hw: null, shortResponse })?.id,
    ).toBe("sr-1");
  });

  it("returns null when neither exists", () => {
    expect(pickDailyWorkEditorSource({ hw: null, shortResponse: null })).toBeNull();
  });
});

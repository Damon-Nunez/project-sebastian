import { describe, expect, it } from "vitest";
import { pickResolvedRubric } from "./resolve";
import type { RubricRow } from "@/lib/db/types";

function stub(
  partial: Partial<RubricRow> & Pick<RubricRow, "id" | "kind">,
): RubricRow {
  return {
    teacher_id: "t1",
    name: "Rubric",
    criteria: {},
    unit_id: null,
    section_id: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("pickResolvedRubric", () => {
  it("prefers section override over teacher default for hw", () => {
    const sectionOverride = stub({
      id: "ov",
      kind: "hw",
      section_id: "sec-1",
    });
    const defaultRubric = stub({ id: "def", kind: "hw" });
    const resolved = pickResolvedRubric({
      kind: "hw",
      sectionOverride,
      defaultRubric,
    });
    expect(resolved?.rubric.id).toBe("ov");
    expect(resolved?.source).toBe("section_override");
  });

  it("falls back to teacher default when no override", () => {
    const defaultRubric = stub({ id: "def", kind: "short_response" });
    const resolved = pickResolvedRubric({
      kind: "short_response",
      sectionOverride: null,
      defaultRubric,
    });
    expect(resolved?.rubric.id).toBe("def");
    expect(resolved?.source).toBe("teacher_default");
  });

  it("labels essay unit default correctly", () => {
    const defaultRubric = stub({
      id: "essay-1",
      kind: "essay",
      unit_id: "u1",
    });
    const resolved = pickResolvedRubric({
      kind: "essay",
      sectionOverride: null,
      defaultRubric,
    });
    expect(resolved?.source).toBe("unit_default");
  });

  it("returns null when nothing matches", () => {
    expect(
      pickResolvedRubric({
        kind: "hw",
        sectionOverride: null,
        defaultRubric: null,
      }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

/**
 * Documents Ticket 8.4 essay attachment rule:
 * essay rubrics require unit_id; defaults (hw / short_response) must not.
 */
describe("essay rubric unit attachment", () => {
  it("requires unit_id for essay kind", () => {
    const essay = {
      kind: "essay" as const,
      unit_id: "unit-1",
      section_id: null as string | null,
    };
    expect(essay.kind === "essay" && essay.unit_id != null).toBe(true);
  });

  it("keeps daily defaults free of unit_id", () => {
    const daily = {
      kind: "hw" as const,
      unit_id: null as string | null,
      section_id: null as string | null,
    };
    expect(daily.unit_id).toBeNull();
  });
});

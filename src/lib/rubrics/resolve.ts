import type { RubricKind, RubricRow } from "@/lib/db/types";
import { getDefaultRubricForKind } from "@/lib/rubrics/defaults";
import { getSectionDailyOverrideForKind } from "@/lib/rubrics/overrides";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const RUBRIC_SELECT =
  "id, teacher_id, kind, name, criteria, unit_id, section_id, created_at, updated_at";

export type ResolveRubricInput = {
  teacherId: string;
  kind: RubricKind;
  /** Required when kind is essay. */
  unitId?: string | null;
  /** When set, prefer a section override over the shared default (daily kinds). */
  sectionId?: string | null;
};

export type ResolvedRubric = {
  rubric: RubricRow;
  /** section_override | teacher_default | unit_default */
  source: "section_override" | "teacher_default" | "unit_default";
};

/**
 * Pure priority helper for tests / callers that already loaded candidates.
 * Daily: section override → teacher default.
 * Essay: section+unit override → unit default (section_id null).
 */
export function pickResolvedRubric(input: {
  kind: RubricKind;
  sectionOverride: RubricRow | null;
  defaultRubric: RubricRow | null;
}): ResolvedRubric | null {
  if (input.sectionOverride) {
    return { rubric: input.sectionOverride, source: "section_override" };
  }
  if (input.defaultRubric) {
    return {
      rubric: input.defaultRubric,
      source: input.kind === "essay" ? "unit_default" : "teacher_default",
    };
  }
  return null;
}

async function getEssayDefaultForUnit(input: {
  teacherId: string;
  unitId: string;
}): Promise<RubricRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("rubrics")
    .select(RUBRIC_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("kind", "essay")
    .eq("unit_id", input.unitId)
    .is("section_id", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to resolve essay rubric: ${error.message}`);
  }

  return (data?.[0] as RubricRow | undefined) ?? null;
}

async function getEssaySectionOverride(input: {
  teacherId: string;
  unitId: string;
  sectionId: string;
}): Promise<RubricRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("rubrics")
    .select(RUBRIC_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("kind", "essay")
    .eq("unit_id", input.unitId)
    .eq("section_id", input.sectionId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to resolve essay section override: ${error.message}`,
    );
  }

  return (data?.[0] as RubricRow | undefined) ?? null;
}

/**
 * Resolve which rubric applies for grading (Tickets 9–10).
 * - hw / short_response: section override → shared teacher default
 * - essay: requires unitId; section+unit override → unit default
 */
export async function resolveRubric(
  input: ResolveRubricInput,
): Promise<ResolvedRubric | null> {
  if (input.kind === "essay") {
    if (!input.unitId) {
      throw new Error("unitId is required to resolve an essay rubric");
    }

    const sectionOverride = input.sectionId
      ? await getEssaySectionOverride({
          teacherId: input.teacherId,
          unitId: input.unitId,
          sectionId: input.sectionId,
        })
      : null;
    const defaultRubric = await getEssayDefaultForUnit({
      teacherId: input.teacherId,
      unitId: input.unitId,
    });

    return pickResolvedRubric({
      kind: "essay",
      sectionOverride,
      defaultRubric,
    });
  }

  const sectionOverride = input.sectionId
    ? await getSectionDailyOverrideForKind({
        teacherId: input.teacherId,
        sectionId: input.sectionId,
        kind: input.kind,
      })
    : null;
  const defaultRubric = await getDefaultRubricForKind(
    input.teacherId,
    input.kind,
  );

  return pickResolvedRubric({
    kind: input.kind,
    sectionOverride,
    defaultRubric,
  });
}

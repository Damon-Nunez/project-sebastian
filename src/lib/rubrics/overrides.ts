import type { RubricRow } from "@/lib/db/types";
import {
  parseRubricCriteria,
  type RubricCriteria,
} from "@/lib/rubrics/criteria";
import {
  DAILY_WORK_KINDS,
  getDailyWorkDefaults,
  pickDailyWorkEditorSource,
  type DailyWorkKind,
} from "@/lib/rubrics/defaults";
import { normalizeRequiredName } from "@/lib/roster/validate";
import { getPeriodForTeacher } from "@/lib/roster/periods";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const RUBRIC_SELECT =
  "id, teacher_id, kind, name, criteria, unit_id, section_id, created_at, updated_at";

export async function getSectionDailyOverrideForKind(input: {
  teacherId: string;
  sectionId: string;
  kind: DailyWorkKind;
}): Promise<RubricRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("rubrics")
    .select(RUBRIC_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("kind", input.kind)
    .eq("section_id", input.sectionId)
    .is("unit_id", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to load section ${input.kind} override: ${error.message}`,
    );
  }

  return (data?.[0] as RubricRow | undefined) ?? null;
}

export async function getSectionDailyOverrides(input: {
  teacherId: string;
  sectionId: string;
}): Promise<{ hw: RubricRow | null; shortResponse: RubricRow | null }> {
  const [hw, shortResponse] = await Promise.all([
    getSectionDailyOverrideForKind({ ...input, kind: "hw" }),
    getSectionDailyOverrideForKind({ ...input, kind: "short_response" }),
  ]);
  return { hw, shortResponse };
}

export function pickSectionDailyEditorSource(overrides: {
  hw: RubricRow | null;
  shortResponse: RubricRow | null;
}): RubricRow | null {
  return overrides.hw ?? overrides.shortResponse;
}

/** True when this section has at least one daily-work override row. */
export function sectionHasDailyOverride(overrides: {
  hw: RubricRow | null;
  shortResponse: RubricRow | null;
}): boolean {
  return overrides.hw != null || overrides.shortResponse != null;
}

async function upsertSectionDailyKind(input: {
  teacherId: string;
  sectionId: string;
  kind: DailyWorkKind;
  name: string;
  criteria: RubricCriteria;
  existingId: string | null;
}): Promise<RubricRow> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    teacher_id: input.teacherId,
    kind: input.kind,
    name: input.name,
    criteria: input.criteria,
    unit_id: null,
    section_id: input.sectionId,
    updated_at: now,
  };

  if (input.existingId) {
    const { data, error } = await admin
      .from("rubrics")
      .update(payload)
      .eq("teacher_id", input.teacherId)
      .eq("id", input.existingId)
      .eq("section_id", input.sectionId)
      .select(RUBRIC_SELECT)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to update section ${input.kind} override: ${error.message}`,
      );
    }
    if (!data) {
      throw new Error(`Section ${input.kind} override not found`);
    }
    return data as RubricRow;
  }

  const { data, error } = await admin
    .from("rubrics")
    .insert(payload)
    .select(RUBRIC_SELECT)
    .single();

  if (error) {
    throw new Error(
      `Failed to create section ${input.kind} override: ${error.message}`,
    );
  }
  return data as RubricRow;
}

/**
 * Copy-on-write: clone shared daily defaults into section-scoped hw + short_response rows.
 * No-op (returns existing) if overrides already exist.
 */
export async function ensureSectionDailyOverrides(input: {
  teacherId: string;
  sectionId: string;
}): Promise<{ hw: RubricRow; shortResponse: RubricRow }> {
  const period = await getPeriodForTeacher(input.teacherId, input.sectionId);
  if (!period) {
    throw new Error("Period not found");
  }

  const existing = await getSectionDailyOverrides(input);
  if (existing.hw && existing.shortResponse) {
    return { hw: existing.hw, shortResponse: existing.shortResponse };
  }

  const defaults = await getDailyWorkDefaults(input.teacherId);
  const source = pickDailyWorkEditorSource(defaults);
  if (!source) {
    throw new Error(
      "Create a shared daily work rubric first, then customize it for this period.",
    );
  }

  const name =
    normalizeRequiredName(source.name) ?? "Classwork / Homework";
  const criteria = parseRubricCriteria(source.criteria);

  const [hw, shortResponse] = await Promise.all(
    DAILY_WORK_KINDS.map((kind) => {
      const existingId =
        kind === "hw" ? existing.hw?.id ?? null : existing.shortResponse?.id ?? null;
      return upsertSectionDailyKind({
        teacherId: input.teacherId,
        sectionId: input.sectionId,
        kind,
        name,
        criteria,
        existingId,
      });
    }),
  );

  return { hw, shortResponse };
}

/** Update both section daily overrides with the same name + criteria (Approach B). */
export async function updateSectionDailyOverrides(input: {
  teacherId: string;
  sectionId: string;
  name: string;
  criteria: unknown;
}): Promise<{ hw: RubricRow; shortResponse: RubricRow }> {
  const name = normalizeRequiredName(input.name);
  if (!name) {
    throw new Error("Rubric name is required");
  }

  const period = await getPeriodForTeacher(input.teacherId, input.sectionId);
  if (!period) {
    throw new Error("Period not found");
  }

  const criteria = parseRubricCriteria(input.criteria);
  const existing = await getSectionDailyOverrides({
    teacherId: input.teacherId,
    sectionId: input.sectionId,
  });

  if (!existing.hw && !existing.shortResponse) {
    throw new Error("No section override to update — customize this period first.");
  }

  const [hw, shortResponse] = await Promise.all(
    DAILY_WORK_KINDS.map((kind) => {
      const existingId =
        kind === "hw" ? existing.hw?.id ?? null : existing.shortResponse?.id ?? null;
      return upsertSectionDailyKind({
        teacherId: input.teacherId,
        sectionId: input.sectionId,
        kind,
        name,
        criteria,
        existingId,
      });
    }),
  );

  return { hw, shortResponse };
}

/** Delete section daily overrides → fall back to shared defaults. */
export async function deleteSectionDailyOverrides(input: {
  teacherId: string;
  sectionId: string;
}): Promise<void> {
  const period = await getPeriodForTeacher(input.teacherId, input.sectionId);
  if (!period) {
    throw new Error("Period not found");
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("rubrics")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("section_id", input.sectionId)
    .in("kind", [...DAILY_WORK_KINDS])
    .is("unit_id", null);

  if (error) {
    throw new Error(
      `Failed to reset section daily overrides: ${error.message}`,
    );
  }
}

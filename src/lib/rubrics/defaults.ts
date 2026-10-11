import type { RubricKind, RubricRow } from "@/lib/db/types";
import {
  parseRubricCriteria,
  type RubricCriteria,
} from "@/lib/rubrics/criteria";
import { normalizeRequiredName } from "@/lib/roster/validate";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const RUBRIC_SELECT =
  "id, teacher_id, kind, name, criteria, unit_id, section_id, created_at, updated_at";

export const DAILY_WORK_KINDS = ["hw", "short_response"] as const;
export type DailyWorkKind = (typeof DAILY_WORK_KINDS)[number];

export async function getDefaultRubricForKind(
  teacherId: string,
  kind: DailyWorkKind,
): Promise<RubricRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("rubrics")
    .select(RUBRIC_SELECT)
    .eq("teacher_id", teacherId)
    .eq("kind", kind)
    .is("section_id", null)
    .is("unit_id", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load ${kind} rubric: ${error.message}`);
  }

  const row = data?.[0];
  return (row as RubricRow | undefined) ?? null;
}

export async function getDailyWorkDefaults(teacherId: string): Promise<{
  hw: RubricRow | null;
  shortResponse: RubricRow | null;
}> {
  const [hw, shortResponse] = await Promise.all([
    getDefaultRubricForKind(teacherId, "hw"),
    getDefaultRubricForKind(teacherId, "short_response"),
  ]);
  return { hw, shortResponse };
}

/**
 * Preferred source for the daily-work editor: HW row if present, else short-response.
 * Criteria are kept in sync on save (Approach B).
 */
export function pickDailyWorkEditorSource(defaults: {
  hw: RubricRow | null;
  shortResponse: RubricRow | null;
}): RubricRow | null {
  return defaults.hw ?? defaults.shortResponse;
}

/** Insert or update one hw / short_response row. sectionId null is the shared default. */
export async function upsertDailyKind(input: {
  teacherId: string;
  kind: DailyWorkKind;
  name: string;
  criteria: RubricCriteria;
  existingId: string | null;
  sectionId?: string | null;
}): Promise<RubricRow> {
  const sectionId = input.sectionId ?? null;
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    teacher_id: input.teacherId,
    kind: input.kind as RubricKind,
    name: input.name,
    criteria: input.criteria,
    unit_id: null,
    section_id: sectionId,
    updated_at: now,
  };
  const label = sectionId ? `section ${input.kind} override` : `${input.kind} rubric`;

  if (input.existingId) {
    let query = admin
      .from("rubrics")
      .update(payload)
      .eq("teacher_id", input.teacherId)
      .eq("id", input.existingId);
    if (sectionId) query = query.eq("section_id", sectionId);
    const { data, error } = await query.select(RUBRIC_SELECT).maybeSingle();

    if (error) {
      throw new Error(`Failed to update ${label}: ${error.message}`);
    }
    if (!data) {
      throw new Error(
        sectionId
          ? `Section ${input.kind} override not found`
          : `${input.kind} rubric not found`,
      );
    }
    return data as RubricRow;
  }

  const { data, error } = await admin
    .from("rubrics")
    .insert(payload)
    .select(RUBRIC_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create ${label}: ${error.message}`);
  }
  return data as RubricRow;
}

/**
 * Approach B: one form save → same name + criteria on both hw and short_response defaults.
 */
export async function upsertDailyWorkDefaults(input: {
  teacherId: string;
  name: string;
  criteria: unknown;
}): Promise<{ hw: RubricRow; shortResponse: RubricRow }> {
  const name = normalizeRequiredName(input.name);
  if (!name) {
    throw new Error("Rubric name is required");
  }

  const criteria = parseRubricCriteria(input.criteria);
  const existing = await getDailyWorkDefaults(input.teacherId);

  const [hw, shortResponse] = await Promise.all([
    upsertDailyKind({
      teacherId: input.teacherId,
      kind: "hw",
      name,
      criteria,
      existingId: existing.hw?.id ?? null,
    }),
    upsertDailyKind({
      teacherId: input.teacherId,
      kind: "short_response",
      name,
      criteria,
      existingId: existing.shortResponse?.id ?? null,
    }),
  ]);

  return { hw, shortResponse };
}

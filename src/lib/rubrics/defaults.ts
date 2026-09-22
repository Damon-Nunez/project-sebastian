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

/** Pure: both daily kinds share the same payload for Approach B. */
export function dailyWorkKindsToSync(): DailyWorkKind[] {
  return [...DAILY_WORK_KINDS];
}

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

async function upsertOneDefault(input: {
  teacherId: string;
  kind: DailyWorkKind;
  name: string;
  criteria: RubricCriteria;
  existingId: string | null;
}): Promise<RubricRow> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const payload = {
    teacher_id: input.teacherId,
    kind: input.kind as RubricKind,
    name: input.name,
    criteria: input.criteria,
    unit_id: null,
    section_id: null,
    updated_at: now,
  };

  if (input.existingId) {
    const { data, error } = await admin
      .from("rubrics")
      .update(payload)
      .eq("teacher_id", input.teacherId)
      .eq("id", input.existingId)
      .select(RUBRIC_SELECT)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update ${input.kind} rubric: ${error.message}`);
    }
    if (!data) {
      throw new Error(`${input.kind} rubric not found`);
    }
    return data as RubricRow;
  }

  const { data, error } = await admin
    .from("rubrics")
    .insert(payload)
    .select(RUBRIC_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create ${input.kind} rubric: ${error.message}`);
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
    upsertOneDefault({
      teacherId: input.teacherId,
      kind: "hw",
      name,
      criteria,
      existingId: existing.hw?.id ?? null,
    }),
    upsertOneDefault({
      teacherId: input.teacherId,
      kind: "short_response",
      name,
      criteria,
      existingId: existing.shortResponse?.id ?? null,
    }),
  ]);

  return { hw, shortResponse };
}

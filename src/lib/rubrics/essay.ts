import type { RubricRow } from "@/lib/db/types";
import {
  parseRubricCriteria,
  type RubricCriteria,
} from "@/lib/rubrics/criteria";
import { normalizeRequiredName } from "@/lib/roster/validate";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUnitForTeacher } from "@/lib/units/units";

const RUBRIC_SELECT =
  "id, teacher_id, kind, name, criteria, unit_id, section_id, created_at, updated_at";

export async function listEssayRubricsForUnit(input: {
  teacherId: string;
  unitId: string;
}): Promise<RubricRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("rubrics")
    .select(RUBRIC_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("kind", "essay")
    .eq("unit_id", input.unitId)
    .is("section_id", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list essay rubrics: ${error.message}`);
  }

  return (data ?? []) as RubricRow[];
}

export async function getEssayRubricForTeacher(input: {
  teacherId: string;
  rubricId: string;
}): Promise<RubricRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("rubrics")
    .select(RUBRIC_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("id", input.rubricId)
    .eq("kind", "essay")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load essay rubric: ${error.message}`);
  }

  return (data as RubricRow | null) ?? null;
}

export async function createEssayRubric(input: {
  teacherId: string;
  unitId: string;
  name: string;
  criteria: unknown;
}): Promise<RubricRow> {
  const name = normalizeRequiredName(input.name);
  if (!name) {
    throw new Error("Rubric name is required");
  }

  const unit = await getUnitForTeacher(input.teacherId, input.unitId);
  if (!unit) {
    throw new Error("Unit not found");
  }

  const criteria: RubricCriteria = parseRubricCriteria(input.criteria);
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("rubrics")
    .insert({
      teacher_id: input.teacherId,
      kind: "essay",
      name,
      criteria,
      unit_id: input.unitId,
      section_id: null,
      updated_at: now,
    })
    .select(RUBRIC_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create essay rubric: ${error.message}`);
  }

  return data as RubricRow;
}

export async function updateEssayRubric(input: {
  teacherId: string;
  rubricId: string;
  name: string;
  criteria: unknown;
}): Promise<RubricRow> {
  const name = normalizeRequiredName(input.name);
  if (!name) {
    throw new Error("Rubric name is required");
  }

  const existing = await getEssayRubricForTeacher({
    teacherId: input.teacherId,
    rubricId: input.rubricId,
  });
  if (!existing) {
    throw new Error("Essay rubric not found");
  }

  const criteria = parseRubricCriteria(input.criteria);
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("rubrics")
    .update({
      name,
      criteria,
      updated_at: now,
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.rubricId)
    .eq("kind", "essay")
    .select(RUBRIC_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update essay rubric: ${error.message}`);
  }
  if (!data) {
    throw new Error("Essay rubric not found");
  }

  return data as RubricRow;
}

export async function deleteEssayRubric(input: {
  teacherId: string;
  rubricId: string;
}): Promise<{ unitId: string }> {
  const existing = await getEssayRubricForTeacher({
    teacherId: input.teacherId,
    rubricId: input.rubricId,
  });
  if (!existing?.unit_id) {
    throw new Error("Essay rubric not found");
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("rubrics")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("id", input.rubricId)
    .eq("kind", "essay")
    .select("id, unit_id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete essay rubric: ${error.message}`);
  }
  if (!data) {
    throw new Error("Essay rubric not found");
  }

  return { unitId: existing.unit_id };
}

import type { SectionRow } from "@/lib/db/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  normalizeOptionalText,
  normalizeRequiredName,
} from "@/lib/roster/validate";
import { listStudentsForTeacher } from "@/lib/roster/students";

const SECTION_SELECT =
  "id, teacher_id, name, school_year, created_at, updated_at";

export async function listPeriodsForTeacher(
  teacherId: string,
): Promise<SectionRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("sections")
    .select(SECTION_SELECT)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list periods: ${error.message}`);
  }

  return (data ?? []) as SectionRow[];
}

export async function getPeriodForTeacher(
  teacherId: string,
  periodId: string,
): Promise<SectionRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("sections")
    .select(SECTION_SELECT)
    .eq("teacher_id", teacherId)
    .eq("id", periodId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load period: ${error.message}`);
  }

  return (data as SectionRow | null) ?? null;
}

export async function createPeriod(input: {
  teacherId: string;
  name: string;
  schoolYear?: string | null;
}): Promise<SectionRow> {
  const name = normalizeRequiredName(input.name);
  if (!name) {
    throw new Error("Period name is required");
  }

  const schoolYear = normalizeOptionalText(input.schoolYear);
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("sections")
    .insert({
      teacher_id: input.teacherId,
      name,
      school_year: schoolYear,
      updated_at: now,
    })
    .select(SECTION_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create period: ${error.message}`);
  }

  return data as SectionRow;
}

export async function updatePeriod(input: {
  teacherId: string;
  periodId: string;
  name: string;
  schoolYear?: string | null;
}): Promise<SectionRow> {
  const name = normalizeRequiredName(input.name);
  if (!name) {
    throw new Error("Period name is required");
  }

  const schoolYear = normalizeOptionalText(input.schoolYear);
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("sections")
    .update({
      name,
      school_year: schoolYear,
      updated_at: now,
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.periodId)
    .select(SECTION_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update period: ${error.message}`);
  }

  if (!data) {
    throw new Error("Period not found");
  }

  return data as SectionRow;
}

export async function deletePeriod(input: {
  teacherId: string;
  periodId: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("sections")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("id", input.periodId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete period: ${error.message}`);
  }

  if (!data) {
    throw new Error("Period not found");
  }
}

// ── Roster joins ────────────────────────────────────────────────────────────

/** Lean student row for lesson-plan groupings UI / sanitizer. */
export type PeriodRosterStudent = {
  id: string;
  name: string;
  nickname: string | null;
};

/** Period + its roster, shaped for the draft editor (serializable props). */
export type PeriodWithRoster = {
  id: string;
  name: string;
  schoolYear: string | null;
  students: PeriodRosterStudent[];
};

type PeriodInput = { id: string; name: string; school_year: string | null };
type StudentInput = { id: string; name: string; nickname: string | null; section_id: string };

/** Pure join used by listPeriodsWithRostersForTeacher (and tests). */
export function buildPeriodsWithRosters(
  periods: PeriodInput[],
  students: StudentInput[],
): PeriodWithRoster[] {
  const byPeriod = new Map<string, PeriodRosterStudent[]>();
  for (const student of students) {
    const list = byPeriod.get(student.section_id) ?? [];
    list.push({ id: student.id, name: student.name, nickname: student.nickname });
    byPeriod.set(student.section_id, list);
  }
  return periods.map((period) => ({
    id: period.id,
    name: period.name,
    schoolYear: period.school_year,
    students: byPeriod.get(period.id) ?? [],
  }));
}

/**
 * All periods for the teacher with students grouped under each period.
 * Period order matches listPeriodsForTeacher; students stay name-sorted.
 */
export async function listPeriodsWithRostersForTeacher(
  teacherId: string,
): Promise<PeriodWithRoster[]> {
  const [periods, students] = await Promise.all([
    listPeriodsForTeacher(teacherId),
    listStudentsForTeacher(teacherId),
  ]);
  return buildPeriodsWithRosters(periods, students);
}

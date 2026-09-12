import type { StudentRow } from "@/lib/db/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  normalizeOptionalText,
  normalizeRequiredName,
} from "@/lib/roster/validate";

const STUDENT_SELECT =
  "id, teacher_id, section_id, name, nickname, notes, created_at, updated_at";

export async function listStudentsForPeriod(input: {
  teacherId: string;
  periodId: string;
}): Promise<StudentRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("students")
    .select(STUDENT_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("section_id", input.periodId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list students: ${error.message}`);
  }

  return (data ?? []) as StudentRow[];
}

/** All students for a teacher across periods (ordered by name). */
export async function listStudentsForTeacher(
  teacherId: string,
): Promise<StudentRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("students")
    .select(STUDENT_SELECT)
    .eq("teacher_id", teacherId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list students: ${error.message}`);
  }

  return (data ?? []) as StudentRow[];
}

export async function createStudent(input: {
  teacherId: string;
  periodId: string;
  name: string;
  nickname?: string | null;
  notes?: string | null;
}): Promise<StudentRow> {
  const name = normalizeRequiredName(input.name);
  if (!name) {
    throw new Error("Student name is required");
  }

  const nickname = normalizeOptionalText(input.nickname);
  const notes = normalizeOptionalText(input.notes);
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("students")
    .insert({
      teacher_id: input.teacherId,
      section_id: input.periodId,
      name,
      nickname,
      notes,
      updated_at: now,
    })
    .select(STUDENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to add student: ${error.message}`);
  }

  return data as StudentRow;
}

export async function updateStudent(input: {
  teacherId: string;
  periodId: string;
  studentId: string;
  name: string;
  nickname?: string | null;
  notes?: string | null;
}): Promise<StudentRow> {
  const name = normalizeRequiredName(input.name);
  if (!name) {
    throw new Error("Student name is required");
  }

  const nickname = normalizeOptionalText(input.nickname);
  const notes = normalizeOptionalText(input.notes);
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("students")
    .update({ name, nickname, notes, updated_at: now })
    .eq("teacher_id", input.teacherId)
    .eq("section_id", input.periodId)
    .eq("id", input.studentId)
    .select(STUDENT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update student: ${error.message}`);
  }

  if (!data) {
    throw new Error("Student not found");
  }

  return data as StudentRow;
}

export async function deleteStudent(input: {
  teacherId: string;
  periodId: string;
  studentId: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("students")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("section_id", input.periodId)
    .eq("id", input.studentId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to remove student: ${error.message}`);
  }

  if (!data) {
    throw new Error("Student not found");
  }
}

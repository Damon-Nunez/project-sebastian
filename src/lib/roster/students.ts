import type { StudentRow } from "@/lib/db/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  normalizeOptionalText,
  normalizeRequiredName,
} from "@/lib/roster/validate";

const STUDENT_SELECT_WITH_NICKNAME =
  "id, teacher_id, section_id, name, nickname, notes, created_at, updated_at";

const STUDENT_SELECT_BASE =
  "id, teacher_id, section_id, name, notes, created_at, updated_at";

function isMissingNicknameColumn(message: string): boolean {
  return (
    message.includes("nickname") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function asStudentRow(
  row: Omit<StudentRow, "nickname"> & { nickname?: string | null },
): StudentRow {
  return {
    ...row,
    nickname: row.nickname ?? null,
  };
}

export async function listStudentsForPeriod(input: {
  teacherId: string;
  periodId: string;
}): Promise<StudentRow[]> {
  const admin = createAdminSupabaseClient();
  const primary = await admin
    .from("students")
    .select(STUDENT_SELECT_WITH_NICKNAME)
    .eq("teacher_id", input.teacherId)
    .eq("section_id", input.periodId)
    .order("name", { ascending: true });

  if (primary.error && isMissingNicknameColumn(primary.error.message)) {
    const fallback = await admin
      .from("students")
      .select(STUDENT_SELECT_BASE)
      .eq("teacher_id", input.teacherId)
      .eq("section_id", input.periodId)
      .order("name", { ascending: true });

    if (fallback.error) {
      throw new Error(`Failed to list students: ${fallback.error.message}`);
    }

    return (fallback.data ?? []).map((row) =>
      asStudentRow(row as Omit<StudentRow, "nickname">),
    );
  }

  if (primary.error) {
    throw new Error(`Failed to list students: ${primary.error.message}`);
  }

  return (primary.data ?? []) as StudentRow[];
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

  const withNickname = await admin
    .from("students")
    .insert({
      teacher_id: input.teacherId,
      section_id: input.periodId,
      name,
      nickname,
      notes,
      updated_at: now,
    })
    .select(STUDENT_SELECT_WITH_NICKNAME)
    .single();

  if (
    withNickname.error &&
    isMissingNicknameColumn(withNickname.error.message)
  ) {
    const fallback = await admin
      .from("students")
      .insert({
        teacher_id: input.teacherId,
        section_id: input.periodId,
        name,
        notes,
        updated_at: now,
      })
      .select(STUDENT_SELECT_BASE)
      .single();

    if (fallback.error) {
      throw new Error(`Failed to add student: ${fallback.error.message}`);
    }

    return asStudentRow(fallback.data as Omit<StudentRow, "nickname">);
  }

  if (withNickname.error) {
    throw new Error(`Failed to add student: ${withNickname.error.message}`);
  }

  return withNickname.data as StudentRow;
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

  const withNickname = await admin
    .from("students")
    .update({
      name,
      nickname,
      notes,
      updated_at: now,
    })
    .eq("teacher_id", input.teacherId)
    .eq("section_id", input.periodId)
    .eq("id", input.studentId)
    .select(STUDENT_SELECT_WITH_NICKNAME)
    .maybeSingle();

  if (
    withNickname.error &&
    isMissingNicknameColumn(withNickname.error.message)
  ) {
    const fallback = await admin
      .from("students")
      .update({
        name,
        notes,
        updated_at: now,
      })
      .eq("teacher_id", input.teacherId)
      .eq("section_id", input.periodId)
      .eq("id", input.studentId)
      .select(STUDENT_SELECT_BASE)
      .maybeSingle();

    if (fallback.error) {
      throw new Error(`Failed to update student: ${fallback.error.message}`);
    }

    if (!fallback.data) {
      throw new Error("Student not found");
    }

    return asStudentRow(fallback.data as Omit<StudentRow, "nickname">);
  }

  if (withNickname.error) {
    throw new Error(`Failed to update student: ${withNickname.error.message}`);
  }

  if (!withNickname.data) {
    throw new Error("Student not found");
  }

  return withNickname.data as StudentRow;
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

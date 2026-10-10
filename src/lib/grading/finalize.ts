/**
 * Teacher review → mark final (Ticket 11 / SCRUM-140).
 * Jupiter stays manual — we only store grade/comment in-app.
 */
import type { GradingSuggestionRow } from "@/lib/db/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SUGGESTION_SELECT } from "./fileHomework";

export class FinalizeError extends Error {
  constructor(
    readonly code:
      | "suggestion_not_found"
      | "grade_required"
      | "grade_invalid"
      | "nothing_to_finalize",
  ) {
    super(code);
    this.name = "FinalizeError";
  }
}

/** Accept 0–100 (integers or one decimal). */
export function parseTeacherGrade(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}(\.\d)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

/** Midpoint of the AI range, for pre-filling before the teacher edits. */
export function midpointGrade(
  low: number | null,
  high: number | null,
): number | null {
  if (low == null || high == null) return null;
  return Math.round((low + high) / 2);
}

export function defaultGradeForSuggestion(
  suggestion: Pick<
    GradingSuggestionRow,
    "teacher_grade" | "suggested_range_low" | "suggested_range_high"
  >,
): number | null {
  if (suggestion.teacher_grade != null) return suggestion.teacher_grade;
  return midpointGrade(
    suggestion.suggested_range_low,
    suggestion.suggested_range_high,
  );
}

export function defaultCommentForSuggestion(
  suggestion: Pick<
    GradingSuggestionRow,
    "teacher_comment" | "suggested_comment"
  >,
): string {
  return suggestion.teacher_comment ?? suggestion.suggested_comment ?? "";
}

async function loadOwnedSuggestion(input: {
  teacherId: string;
  suggestionId: string;
}): Promise<GradingSuggestionRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("grading_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("id", input.suggestionId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load suggestion: ${error.message}`);
  }
  return (data as GradingSuggestionRow | null) ?? null;
}

/** Save teacher grade + comment and mark the suggestion final. */
export async function finalizeSuggestion(input: {
  teacherId: string;
  suggestionId: string;
  gradeRaw: string;
  comment: string;
}): Promise<GradingSuggestionRow> {
  const existing = await loadOwnedSuggestion(input);
  if (!existing) throw new FinalizeError("suggestion_not_found");

  const grade = parseTeacherGrade(input.gradeRaw);
  if (grade == null) {
    throw new FinalizeError(
      input.gradeRaw.trim() ? "grade_invalid" : "grade_required",
    );
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("grading_suggestions")
    .update({
      teacher_grade: grade,
      teacher_comment: input.comment.trim() || null,
      status: "final",
      updated_at: new Date().toISOString(),
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.suggestionId)
    .select(SUGGESTION_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to finalize suggestion: ${error.message}`);
  }
  return data as GradingSuggestionRow;
}

/**
 * Finalize every non-final suggestion in the session that has a usable grade
 * (teacher_grade already set, or an AI range to take the midpoint from).
 */
export async function finalizeAllInSession(input: {
  teacherId: string;
  sessionId: string;
}): Promise<{ finalized: number }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("grading_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("grading_session_id", input.sessionId)
    .neq("status", "final");

  if (error) {
    throw new Error(`Failed to list suggestions: ${error.message}`);
  }

  const rows = (data ?? []) as GradingSuggestionRow[];
  const ready = rows.filter(
    (row) => defaultGradeForSuggestion(row) != null,
  );
  if (ready.length === 0) {
    throw new FinalizeError("nothing_to_finalize");
  }

  const now = new Date().toISOString();
  await Promise.all(
    ready.map(async (row) => {
      const grade = defaultGradeForSuggestion(row);
      if (grade == null) return;
      const { error: updateError } = await admin
        .from("grading_suggestions")
        .update({
          teacher_grade: grade,
          teacher_comment: defaultCommentForSuggestion(row) || null,
          status: "final",
          updated_at: now,
        })
        .eq("teacher_id", input.teacherId)
        .eq("id", row.id);
      if (updateError) {
        throw new Error(`Failed to finalize suggestion: ${updateError.message}`);
      }
    }),
  );

  return { finalized: ready.length };
}

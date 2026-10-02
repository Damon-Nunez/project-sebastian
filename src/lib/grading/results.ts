/**
 * Read side of AI grading for the folder page (Ticket 10 / SCRUM-131).
 */
import type { AiGradingStatus, GradingSuggestionRow } from "@/lib/db/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SUGGESTION_SELECT } from "./fileHomework";
import type { GradeDetail } from "./gradeWork";
import { parseVisionPages, type VisionPage } from "./studentWorkFiles";

export type SessionPaper = {
  suggestion: GradingSuggestionRow;
  studentName: string;
  filename: string | null;
  storagePath: string | null;
  visionPages: VisionPage[];
  detail: GradeDetail | null;
};

/** grading_detail is jsonb — only trust shapes this version wrote. */
export function parseGradeDetail(raw: unknown): GradeDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const detail = raw as Partial<GradeDetail>;
  if (
    detail.version !== 1 ||
    !Array.isArray(detail.items) ||
    !Array.isArray(detail.categoryScores) ||
    typeof detail.percent !== "number"
  ) {
    return null;
  }
  return detail as GradeDetail;
}

/** Answer quotes keep [[hl]]-style markers from extraction; drop them for display. */
export function stripAnswerMarkers(text: string): string {
  return text.replace(/\[\[\/?(hl|b|u|s)\]\]/g, "");
}

/** True when the key was replaced after this paper was graded. */
export function gradedAgainstOlderKey(
  gradedReferenceAt: string | null,
  referenceUpdatedAt: string | null,
): boolean {
  if (!gradedReferenceAt || !referenceUpdatedAt) return false;
  return Date.parse(gradedReferenceAt) < Date.parse(referenceUpdatedAt);
}

export const AI_STATUS_LABELS: Record<Exclude<AiGradingStatus, "graded">, string> = {
  pending: "Waiting to grade",
  grading: "Grading…",
  failed: "Couldn't grade — use Retry grading",
  needs_vision: "Photo uploaded before image grading — upload it again to grade",
  awaiting_approval: "Check the masked preview",
  manual: "Not sent to AI — grade by hand",
};

export async function listSessionPapers(input: {
  teacherId: string;
  sessionId: string;
}): Promise<SessionPaper[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("grading_suggestions")
    .select(
      `${SUGGESTION_SELECT}, students(name), documents(original_filename, storage_path, vision_pages)`,
    )
    .eq("teacher_id", input.teacherId)
    .eq("grading_session_id", input.sessionId);

  if (error) {
    throw new Error(`Failed to list papers: ${error.message}`);
  }

  const one = <T,>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : value;

  return (data ?? [])
    .map((row) => {
      const student = one(row.students as { name: string } | { name: string }[] | null);
      type DocumentFields = {
        original_filename: string | null;
        storage_path: string | null;
        vision_pages: unknown;
      };
      const document = one(row.documents as DocumentFields | DocumentFields[] | null);
      const suggestion = row as unknown as GradingSuggestionRow;
      return {
        suggestion,
        studentName: student?.name ?? "Student",
        filename: document?.original_filename ?? null,
        storagePath: document?.storage_path ?? null,
        visionPages: parseVisionPages(document?.vision_pages),
        detail: parseGradeDetail(suggestion.grading_detail),
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}

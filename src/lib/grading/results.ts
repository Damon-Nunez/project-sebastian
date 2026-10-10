/**
 * Read side of AI grading for the folder page (Ticket 10 / SCRUM-131).
 */
import type { AiGradingStatus, GradingSuggestionRow } from "@/lib/db/types";
import type { RubricCriteria } from "@/lib/rubrics/criteria";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  defaultCommentForSuggestion,
  defaultGradeForSuggestion,
} from "./finalize";
import { SUGGESTION_SELECT } from "./fileHomework";
import type { Verdict } from "./gradeSchema";
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

export const VERDICT_LABELS: Record<Verdict, string> = {
  correct: "Correct",
  partial: "½ credit",
  incorrect: "Incorrect",
  unanswered: "Unanswered",
  unreadable: "Can't tell",
};

function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function levelLabel(criteria: RubricCriteria | null, level: number): string {
  return (
    criteria?.levels.find((entry) => entry.score === level)?.label ||
    `Level ${level}`
  );
}

function categoryName(criteria: RubricCriteria | null, id: string): string {
  return criteria?.categories.find((entry) => entry.id === id)?.name ?? id;
}

/**
 * Plain text of the "Why this range" breakdown, matching what the paper card shows.
 */
export function formatWhyThisRange(
  detail: GradeDetail,
  criteria: RubricCriteria | null,
): string {
  const blocks: string[] = [];

  for (const item of detail.items) {
    const bits = [`Q${item.label}`];
    if (item.kind === "key" && item.verdict) {
      bits.push(VERDICT_LABELS[item.verdict]);
    } else if (item.rubricLevel !== null) {
      bits.push(
        `Rubric ${item.rubricLevel} · ${levelLabel(criteria, item.rubricLevel)}`,
      );
    }
    if (item.maxPoints !== null) {
      bits.push(`${formatPoints(item.maxPoints)} pts`);
    }

    const lines = [bits.join(" · "), item.reason];
    if (item.studentAnswer) {
      const student = `Student: “${stripAnswerMarkers(item.studentAnswer)}”`;
      const key = item.expectedAnswer
        ? ` · Key: “${stripAnswerMarkers(item.expectedAnswer)}”`
        : "";
      lines.push(student + key);
    }
    blocks.push(lines.join("\n"));
  }

  if (detail.categoryScores.length > 0) {
    blocks.push(
      detail.categoryScores
        .map((score) => {
          const name = categoryName(criteria, score.categoryId);
          const label = levelLabel(criteria, score.level);
          return `${name} — ${score.level} · ${label}. ${score.reason}`;
        })
        .join("\n"),
    );
  }

  blocks.push(
    detail.mode === "points"
      ? "Points come from the answer key; ½ credit is noted per question. Range is the score ±2."
      : "No points on the key, so the rubric levels above set the grade. Range is the score ±2.",
  );

  return blocks.join("\n\n");
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

/** One roster row for the class summary table (Ticket 11 / SCRUM-139–140). */
export type ClassSummaryRow = {
  studentId: string;
  studentName: string;
  /** No filed paper for this assignment. */
  missing: boolean;
  /** Range or final % when graded; null when still in progress / missing. */
  gradeLabel: string | null;
  comment: string | null;
  /** Short status for the Status column (e.g. Missing, Waiting to grade, Final). */
  statusLabel: string;
  accommodationFlagged: boolean;
  suggestionId: string | null;
  /** True when status is already final. */
  isFinal: boolean;
  /** Pre-fill for the grade input (teacher grade or AI midpoint). */
  editableGrade: string;
  /** Pre-fill for the comment input. */
  editableComment: string;
  /** AI suggested range label for display next to the grade field. */
  suggestedRangeLabel: string | null;
};

function gradeLabelForPaper(paper: SessionPaper): string | null {
  const { suggestion } = paper;
  if (suggestion.status === "final" && suggestion.teacher_grade != null) {
    return `${suggestion.teacher_grade}%`;
  }
  if (
    suggestion.ai_status === "graded" &&
    suggestion.suggested_range_low != null &&
    suggestion.suggested_range_high != null
  ) {
    return `${suggestion.suggested_range_low}–${suggestion.suggested_range_high}%`;
  }
  return null;
}

function statusLabelForPaper(paper: SessionPaper): string {
  const { suggestion } = paper;
  if (suggestion.status === "final") return "Final";
  if (suggestion.ai_status === "graded") return "Graded";
  if (suggestion.ai_status) {
    return AI_STATUS_LABELS[suggestion.ai_status];
  }
  return "Not graded";
}

function missingSummaryRow(student: {
  id: string;
  name: string;
}): ClassSummaryRow {
  return {
    studentId: student.id,
    studentName: student.name,
    missing: true,
    gradeLabel: null,
    comment: null,
    statusLabel: "Missing",
    accommodationFlagged: false,
    suggestionId: null,
    isFinal: false,
    editableGrade: "",
    editableComment: "",
    suggestedRangeLabel: null,
  };
}

function paperSummaryRow(
  studentName: string,
  paper: SessionPaper,
): ClassSummaryRow {
  const { suggestion } = paper;
  const defaultGrade = defaultGradeForSuggestion(suggestion);
  const rangeLabel =
    suggestion.suggested_range_low != null &&
    suggestion.suggested_range_high != null
      ? `${suggestion.suggested_range_low}–${suggestion.suggested_range_high}%`
      : null;

  return {
    studentId: suggestion.student_id,
    studentName,
    missing: false,
    gradeLabel: gradeLabelForPaper(paper),
    comment: defaultCommentForSuggestion(suggestion) || null,
    statusLabel: statusLabelForPaper(paper),
    accommodationFlagged: suggestion.accommodation_flagged,
    suggestionId: suggestion.id,
    isFinal: suggestion.status === "final",
    editableGrade: defaultGrade != null ? String(defaultGrade) : "",
    editableComment: defaultCommentForSuggestion(suggestion),
    suggestedRangeLabel: rangeLabel,
  };
}

/**
 * Join period roster to filed papers so every student appears once.
 * Students with no paper get a Missing row (red in the UI).
 */
export function buildClassSummaryRows(input: {
  students: { id: string; name: string }[];
  papers: SessionPaper[];
}): ClassSummaryRow[] {
  const paperByStudent = new Map(
    input.papers.map((paper) => [paper.suggestion.student_id, paper]),
  );
  const seen = new Set<string>();

  const rows: ClassSummaryRow[] = input.students.map((student) => {
    seen.add(student.id);
    const paper = paperByStudent.get(student.id);
    if (!paper) return missingSummaryRow(student);
    return paperSummaryRow(student.name, paper);
  });

  // Papers for students no longer on the roster still show (end of list).
  for (const paper of input.papers) {
    const id = paper.suggestion.student_id;
    if (seen.has(id)) continue;
    rows.push(paperSummaryRow(paper.studentName, paper));
  }

  return rows;
}

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

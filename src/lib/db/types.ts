/**
 * Hand-written row types for Ticket 2 domain schema.
 * Keep in sync with supabase/migrations/003–007 (+ later grading/label migrations).
 */

export type RubricKind = "hw" | "short_response" | "essay";
export type DocumentKind = "framework" | "student_work" | "other";
export type DraftFinalStatus = "draft" | "final";
export type AssignmentType = RubricKind;

export type TeacherRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  /** Default lesson header subject (migration 016). */
  subject: string | null;
  /** Default lesson header grade band, e.g. "8th Grade" (migration 016). */
  grade_label: string | null;
  /** Explicit Mr / Ms / Mx — never inferred (migration 016). */
  honorific: string | null;
  auth_user_id: string | null;
  api_key_encrypted: string | null;
  usage_tokens: number | null;
  created_at: string;
  updated_at: string;
};

export type SectionRow = {
  id: string;
  teacher_id: string;
  name: string;
  school_year: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentRow = {
  id: string;
  teacher_id: string;
  section_id: string;
  name: string;
  nickname: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UnitRow = {
  id: string;
  teacher_id: string;
  label: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RubricRow = {
  id: string;
  teacher_id: string;
  kind: RubricKind;
  name: string | null;
  /**
   * Hybrid rubric grid (levels × categories × cell descriptors).
   * Validate with rubricCriteriaSchema in `@/lib/rubrics/criteria`.
   */
  criteria: unknown;
  unit_id: string | null;
  section_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LessonPlanRow = {
  id: string;
  teacher_id: string;
  module_label: string | null;
  unit_label: string | null;
  lesson_label: string | null;
  /**
   * Parsed / pre-filled / edited plan body (jsonb).
   * Validate with lessonPlanContentSchema in `@/lib/lessons/content`.
   */
  content: unknown;
  /**
   * Per-section temporary groups keyed by section_id (jsonb).
   * Validate with parseSectionGroups in `@/lib/lessons/sectionGroups`.
   */
  section_groups: unknown;
  /**
   * Optional discussion routines for polish (jsonb).
   * Validate with parseOptionalRoutines in `@/lib/lessons/optionalRoutines`.
   */
  optional_routines: unknown;
  free_text_asks: string | null;
  status: DraftFinalStatus;
  drive_file_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  teacher_id: string;
  kind: DocumentKind;
  original_filename: string | null;
  storage_path: string | null;
  lesson_plan_id: string | null;
  grading_session_id: string | null;
  /** Roster student assigned to this student_work upload (migration 019). */
  student_id: string | null;
  /** Extracted / edited plain text (student_work). Null for framework docs. */
  body_text: string | null;
  /** Photo / scanned PDF with empty or sparse text — grade from the stored image (migration 020). */
  needs_vision: boolean;
  /** Assignment a batch upload was dropped into (migration 022). */
  assignment_id: string | null;
  /** Original + masked page images (migration 024); see `parseVisionPages`. */
  vision_pages: unknown;
  created_at: string;
  updated_at: string;
};

export const DOCUMENT_SELECT =
  "id, teacher_id, kind, original_filename, storage_path, lesson_plan_id, grading_session_id, student_id, body_text, needs_vision, assignment_id, vision_pages, created_at, updated_at";

export type LessonWorksheetRow = {
  id: string;
  teacher_id: string;
  lesson_plan_id: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  caption: string;
  created_at: string;
  updated_at: string;
};

export type GradingSessionRow = {
  id: string;
  teacher_id: string;
  section_id: string;
  rubric_id: string;
  assignment_type: AssignmentType;
  title: string | null;
  /** Assignment folder labels (migration 017) — local hierarchy under a period. */
  module_label: string | null;
  unit_label: string | null;
  lesson_label: string | null;
  /** Teacher-level assignment (migration 021). Null for legacy title-only folders. */
  assignment_id: string | null;
  status: DraftFinalStatus;
  created_at: string;
  updated_at: string;
};

export type ReferenceKind = "answer_key" | "exemplar" | "none";

export type AssignmentRow = {
  id: string;
  teacher_id: string;
  assignment_type: AssignmentType;
  /** Optional display name; when set, shown instead of the M/U/L short form. */
  title: string | null;
  module_label: string | null;
  unit_label: string | null;
  lesson_label: string | null;
  /** Essay rubric unit. */
  unit_id: string | null;
  reference_kind: ReferenceKind;
  /** Exemplars may contain student PII — sanitize before any AI call. */
  reference_text: string | null;
  reference_filename: string | null;
  reference_storage_path: string | null;
  reference_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GradingSuggestionRow = {
  id: string;
  teacher_id: string;
  grading_session_id: string;
  student_id: string;
  document_id: string | null;
  suggested_range_low: number | null;
  suggested_range_high: number | null;
  suggested_comment: string | null;
  accommodation_flagged: boolean;
  teacher_grade: number | null;
  teacher_comment: string | null;
  status: DraftFinalStatus;
  /** AI grading progress (migration 023). Null for rows filed before 2.4. */
  ai_status: AiGradingStatus | null;
  /** Validated per-question + rubric detail; see `@/lib/grading/gradeSchema`. */
  grading_detail: unknown;
  graded_reference_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiGradingStatus =
  | "pending"
  | "grading"
  | "graded"
  | "failed"
  | "needs_vision"
  | "awaiting_approval"
  | "manual";

/** Table names used by the domain schema (for health / smoke checks). */
export const DOMAIN_TABLES = [
  "teachers",
  "sections",
  "students",
  "units",
  "rubrics",
  "lesson_plans",
  "documents",
  "lesson_worksheets",
  "assignments",
  "grading_sessions",
  "grading_suggestions",
] as const;

export type DomainTable = (typeof DOMAIN_TABLES)[number];

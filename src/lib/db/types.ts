/**
 * Hand-written row types for Ticket 2 domain schema.
 * Keep in sync with supabase/migrations/003–007.
 */

export type RubricKind = "hw" | "short_response" | "essay";
export type DocumentKind = "framework" | "student_work" | "other";
export type DraftFinalStatus = "draft" | "final";
export type AssignmentType = RubricKind;

export type TeacherRow = {
  id: string;
  email: string | null;
  display_name: string | null;
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
  created_at: string;
  updated_at: string;
};

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
  status: DraftFinalStatus;
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
  created_at: string;
  updated_at: string;
};

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
  "grading_sessions",
  "grading_suggestions",
] as const;

export type DomainTable = (typeof DOMAIN_TABLES)[number];

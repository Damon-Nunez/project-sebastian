/**
 * Teacher profile → lesson header line helpers (SCRUM-106).
 * Honorific is explicit on the teacher row — never guessed from first name.
 */

export const DEFAULT_LESSON_TIME_FRAME = "1 class period";

/** Chosen by the teacher. Never inferred from the Google name. */
export const HONORIFICS = ["Mr", "Ms", "Mx"] as const;
export type Honorific = (typeof HONORIFICS)[number];

export function isHonorific(value: string): value is Honorific {
  return (HONORIFICS as readonly string[]).includes(value);
}

/** MVP welcome-step subjects. Stored as the lesson-header subject line. */
export const CORE_SUBJECTS = ["Math", "Science", "ELA", "History"] as const;
export type CoreSubject = (typeof CORE_SUBJECTS)[number];

/** K, then 1 through 12. Stored as the lesson-header grade line. */
export const GRADE_BANDS = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

export function isCoreSubject(value: string): value is CoreSubject {
  return (CORE_SUBJECTS as readonly string[]).includes(value);
}

export function isGradeBand(value: string): value is GradeBand {
  return (GRADE_BANDS as readonly string[]).includes(value);
}

/** Map a saved subject onto the MVP list. Blank when it does not match. */
export function coreSubjectOrEmpty(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (isCoreSubject(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes("ela") || lower.includes("english")) return "ELA";
  if (lower === "math" || lower.includes("mathematics")) return "Math";
  if (lower.includes("science")) return "Science";
  if (lower.includes("history")) return "History";
  return "";
}

/** Map a saved grade onto K–12. "8th Grade" becomes "8". */
export function gradeBandOrEmpty(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (isGradeBand(trimmed)) return trimmed;
  if (/^k(indergarten)?$/i.test(trimmed)) return "K";
  const match = trimmed.match(/^(\d{1,2})/);
  if (match && isGradeBand(match[1]!)) return match[1]!;
  return "";
}

export type TeacherHeaderProfile = {
  subject: string | null;
  grade_label: string | null;
  honorific: string | null;
  display_name: string | null;
};

/** Last whitespace-separated token of a display name (e.g. "Damon Nunez" → "Nunez"). */
export function lastNameFromDisplayName(
  displayName: string | null | undefined,
): string {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts[parts.length - 1]!;
}

/**
 * Build "Mr Nunez" / "Ms George" from honorific + display name.
 * Falls back to display name alone when honorific is missing.
 */
export function formatTeacherLine(
  honorific: string | null | undefined,
  displayName: string | null | undefined,
): string {
  const title = (honorific ?? "").trim();
  const last = lastNameFromDisplayName(displayName);
  const full = (displayName ?? "").trim();

  if (title && last) return `${title} ${last}`;
  if (title && full) return `${title} ${full}`;
  if (full) return full;
  if (title) return title;
  return "";
}

export function teacherHeaderDefaults(profile: TeacherHeaderProfile): {
  subject: string;
  gradeLabel: string;
  teacherLine: string;
  timeFrame: string;
} {
  return {
    subject: (profile.subject ?? "").trim(),
    gradeLabel: (profile.grade_label ?? "").trim(),
    teacherLine: formatTeacherLine(profile.honorific, profile.display_name),
    timeFrame: DEFAULT_LESSON_TIME_FRAME,
  };
}

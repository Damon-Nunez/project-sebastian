/**
 * Teacher profile → lesson header line helpers (SCRUM-106).
 * Honorific is explicit on the teacher row — never guessed from first name.
 */

export const DEFAULT_LESSON_TIME_FRAME = "1 class period";

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

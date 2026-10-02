/**
 * Assignment-folder labels for grading sessions (period → M/U/L).
 * Flexible strings — same spirit as lesson plan labels.
 */

export type AssignmentFolderLabels = {
  module_label: string | null;
  unit_label: string | null;
  lesson_label: string | null;
};

/** Trim; empty → null. */
export function normalizeFolderLabel(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeAssignmentFolderLabels(input: {
  moduleLabel?: string | null;
  unitLabel?: string | null;
  lessonLabel?: string | null;
}): AssignmentFolderLabels {
  return {
    module_label: normalizeFolderLabel(input.moduleLabel),
    unit_label: normalizeFolderLabel(input.unitLabel),
    lesson_label: normalizeFolderLabel(input.lessonLabel),
  };
}

/** True when at least one of module / unit / lesson is set. */
export function hasAssignmentFolderPath(labels: AssignmentFolderLabels): boolean {
  return Boolean(
    labels.module_label || labels.unit_label || labels.lesson_label,
  );
}

/** Compact type tag on a folder name: HW / CW / Essay. */
export function assignmentTypeFolderSuffix(
  assignmentType?: string | null,
): string {
  if (assignmentType === "short_response") return "CW";
  if (assignmentType === "essay") return "Essay";
  return "HW";
}

/**
 * Display name for an assignment / period folder.
 * Optional title wins; otherwise M1U1L1-HW; otherwise Untitled-HW.
 */
export function formatAssignmentFolderTitle(
  labels: AssignmentFolderLabels,
  title?: string | null,
  assignmentType?: string | null,
): string {
  const trimmedTitle = (title ?? "").trim();
  if (trimmedTitle.length > 0) return trimmedTitle;

  const mul: string[] = [];
  if (labels.module_label) mul.push(`M${labels.module_label}`);
  if (labels.unit_label) mul.push(`U${labels.unit_label}`);
  if (labels.lesson_label) mul.push(`L${labels.lesson_label}`);
  const suffix = assignmentTypeFolderSuffix(assignmentType);

  if (mul.length > 0) return `${mul.join("")}-${suffix}`;
  return `Untitled-${suffix}`;
}

/** Compact key for comparisons / tests (null → ""). */
export function assignmentFolderKey(labels: AssignmentFolderLabels): string {
  return [
    labels.module_label ?? "",
    labels.unit_label ?? "",
    labels.lesson_label ?? "",
  ].join("|");
}

export function assignmentFolderLabelsEqual(
  a: AssignmentFolderLabels,
  b: AssignmentFolderLabels,
): boolean {
  return assignmentFolderKey(a) === assignmentFolderKey(b);
}

/** Pick the first session whose M/U/L path matches (pure; for tests + callers). */
export function findSessionByFolderLabels<
  T extends AssignmentFolderLabels & { assignment_type: string },
>(
  sessions: T[],
  labels: AssignmentFolderLabels,
  assignmentType: string,
): T | null {
  return (
    sessions.find(
      (session) =>
        session.assignment_type === assignmentType &&
        assignmentFolderLabelsEqual(session, labels),
    ) ?? null
  );
}

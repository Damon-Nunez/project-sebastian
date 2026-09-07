import {
  fullNameOrderVariants,
  haystackHasNameVariant,
  normalizePersonName,
} from "./names";
import type { RosterStudent, StudentMatchResult } from "./types";

/**
 * Normalize filename or header snippet for local matching:
 * strip extension, turn _/- into spaces, collapse whitespace, lowercase.
 */
export function normalizeMatchHaystack(raw: string): string {
  return raw
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\.(pdf|docx|doc|txt)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Match a document to a roster student from filename and/or header text.
 * V1: local whole-variant match — no AI, no nickname dictionary.
 *
 * - 1 hit → matched (identifier to use for that upload)
 * - 0 hits → none (Ticket 9 manual picker)
 * - 2+ different students → ambiguous (Ticket 9 manual picker)
 */
export function matchStudentFromDocument(
  roster: RosterStudent[],
  parts: { filename?: string | null; headerText?: string | null },
): StudentMatchResult {
  const haystack = normalizeMatchHaystack(
    [parts.filename ?? "", parts.headerText ?? ""].filter(Boolean).join(" "),
  );

  if (!haystack) {
    return { status: "none" };
  }

  const hits: RosterStudent[] = [];

  for (const student of roster) {
    const name = normalizePersonName(student.name);
    if (!name) continue;

    const matched = fullNameOrderVariants(name).some((variant) =>
      haystackHasNameVariant(haystack, variant),
    );
    if (matched) {
      hits.push(student);
    }
  }

  const uniqueById = [...new Map(hits.map((s) => [s.id, s])).values()].sort(
    (a, b) => a.id.localeCompare(b.id),
  );

  if (uniqueById.length === 0) return { status: "none" };
  if (uniqueById.length === 1) {
    return { status: "matched", student: uniqueById[0]! };
  }
  return { status: "ambiguous", candidates: uniqueById };
}

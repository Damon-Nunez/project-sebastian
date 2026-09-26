/**
 * Assignment reference (answer key / exemplar / none) — pure helpers
 * for Ticket 10 / SCRUM-128.
 */
import type { ReferenceKind } from "@/lib/db/types";

export const REFERENCE_KINDS: readonly ReferenceKind[] = [
  "answer_key",
  "exemplar",
  "none",
];

export const MAX_REFERENCE_CHARS = 50_000;

export const REFERENCE_FILE_ACCEPT =
  ".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function parseReferenceKind(raw: unknown): ReferenceKind | null {
  return REFERENCE_KINDS.includes(raw as ReferenceKind)
    ? (raw as ReferenceKind)
    : null;
}

export function referenceKindLabel(kind: ReferenceKind): string {
  if (kind === "answer_key") return "Answer key";
  if (kind === "exemplar") return "Example";
  return "No answer key — graded on rubric only";
}

export function normalizeReferenceText(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type ReferenceValidationError =
  | "reference_text_required"
  | "reference_too_long";

/**
 * answer_key / exemplar need real text; none clears it.
 * Returns the text to store, or an error code.
 */
export function validateReferenceText(
  kind: ReferenceKind,
  raw: string | null | undefined,
): { ok: true; text: string | null } | { ok: false; code: ReferenceValidationError } {
  if (kind === "none") return { ok: true, text: null };
  const text = normalizeReferenceText(raw);
  if (!text) return { ok: false, code: "reference_text_required" };
  if (text.length > MAX_REFERENCE_CHARS) {
    return { ok: false, code: "reference_too_long" };
  }
  return { ok: true, text };
}

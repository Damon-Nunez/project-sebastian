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

/** Photo answer keys can be longer than a student paper (CamScanner multi-page). */
export const MAX_REFERENCE_PHOTO_PAGES = 20;

export type ReferencePageFile = { storagePath: string; filename: string };

/** Encode one or many stored reference page paths into assignments.reference_storage_path. */
export function encodeReferenceStoragePath(pages: ReferencePageFile[]): string | null {
  if (pages.length === 0) return null;
  if (pages.length === 1) return pages[0]!.storagePath;
  return JSON.stringify({ v: 1, pages });
}

/** Decode legacy single path or multi-page JSON payload. */
export function decodeReferenceStoragePath(
  raw: string | null | undefined,
  fallbackFilename = "reference",
): ReferencePageFile[] {
  if (!raw) return [];
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as {
        v?: number;
        pages?: Array<{ storagePath?: string; filename?: string }>;
      };
      if (parsed.v === 1 && Array.isArray(parsed.pages)) {
        return parsed.pages.flatMap((page) =>
          page.storagePath
            ? [
                {
                  storagePath: page.storagePath,
                  filename: page.filename || fallbackFilename,
                },
              ]
            : [],
        );
      }
    } catch {
      // fall through — treat as a plain storage path
    }
  }
  return [{ storagePath: raw, filename: fallbackFilename }];
}

export const REFERENCE_FILE_ACCEPT =
  ".docx,.pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/heic,image/heif";

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

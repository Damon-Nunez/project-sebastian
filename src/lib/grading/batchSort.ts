/**
 * Local Ready / Unsorted sorting for batch uploads (Ticket 10 / SCRUM-129).
 * No AI: roster name match + word overlap against the answer key.
 * Photos use their local OCR text (SCRUM-132), so some sort themselves.
 */
import type { AssignmentRow, DocumentRow } from "@/lib/db/types";
import { headerTextForMatch } from "@/lib/grading/headerText";
import {
  matchHomeworkToRoster,
  type HomeworkMatchCandidate,
} from "@/lib/grading/matchHomework";
import type { PeriodWithRoster } from "@/lib/roster/periods";

/** Share of the key's content words a paper must contain to file cleanly. */
export const MIN_KEY_OVERLAP = 0.3;

/** Keys with fewer distinct content words than this can't be checked. */
const MIN_KEY_WORDS = 5;

const STOPWORDS = new Set([
  "about", "after", "also", "answer", "answers", "because", "been", "before",
  "being", "class", "could", "date", "does", "each", "from", "have", "here",
  "into", "just", "like", "made", "make", "more", "most", "name", "only",
  "other", "period", "question", "questions", "should", "some", "such", "than",
  "that", "their", "them", "then", "there", "these", "they", "this", "those",
  "very", "were", "what", "when", "where", "which", "will", "with", "would",
  "your",
]);

function contentWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
  return new Set(words.filter((w) => w.length >= 4 && !STOPWORDS.has(w)));
}

/**
 * Fraction of the key's distinct content words that appear in the paper.
 * Null when the key is too short to say anything.
 */
export function keyWordOverlap(
  keyText: string,
  paperText: string,
): number | null {
  const keyWords = contentWords(keyText);
  if (keyWords.size < MIN_KEY_WORDS) return null;
  const paperWords = contentWords(paperText);
  let hits = 0;
  for (const word of keyWords) {
    if (paperWords.has(word)) hits += 1;
  }
  return hits / keyWords.size;
}

export type UnsortedReason =
  | "photo"
  | "no_student"
  | "ambiguous_student"
  | "duplicate_in_batch"
  | "multi_page"
  | "already_filed"
  | "no_answer_key"
  | "key_too_short"
  | "low_overlap";

export const UNSORTED_REASON_LABELS: Record<UnsortedReason, string> = {
  photo: "Photo or scan — couldn't read any text",
  no_student: "No student name found",
  ambiguous_student: "Matches more than one student",
  duplicate_in_batch: "Same student appears more than once",
  multi_page: "Same student on more than one photo — possibly multiple pages",
  already_filed: "Student already has work in this assignment",
  no_answer_key: "No answer key to check against",
  key_too_short: "Answer key too short to check against",
  low_overlap: "Doesn't look like this assignment",
};

export type SortedWork =
  | {
      status: "ready";
      document: DocumentRow;
      student: HomeworkMatchCandidate;
      overlap: number;
    }
  | {
      status: "unsorted";
      document: DocumentRow;
      reason: UnsortedReason;
      /** Best guess to pre-select in the manual dropdown. */
      suggestedStudentId: string | null;
    };

/** Combined photos become pages in file-name order (IMG_9 before IMG_10), then upload order. */
export function orderPagesForCombine<
  T extends Pick<DocumentRow, "original_filename" | "created_at">,
>(documents: T[]): T[] {
  return [...documents].sort(
    (a, b) =>
      (a.original_filename ?? "").localeCompare(b.original_filename ?? "", undefined, {
        numeric: true,
        sensitivity: "base",
      }) || a.created_at.localeCompare(b.created_at),
  );
}

export function sortUnfiledWork(input: {
  assignment: Pick<AssignmentRow, "reference_kind" | "reference_text">;
  documents: DocumentRow[];
  periods: PeriodWithRoster[];
  /** Students who already have a filed paper for this assignment. */
  filedStudentIds: ReadonlySet<string>;
}): SortedWork[] {
  const matches = input.documents.map((document) => ({
    document,
    match: matchHomeworkToRoster(input.periods, {
      filename: document.original_filename,
      headerText: headerTextForMatch(document.body_text ?? ""),
    }),
  }));

  const perStudent = new Map<string, number>();
  for (const { match } of matches) {
    if (match.status !== "matched") continue;
    const id = match.student.studentId;
    perStudent.set(id, (perStudent.get(id) ?? 0) + 1);
  }

  const keyText =
    input.assignment.reference_kind === "answer_key"
      ? (input.assignment.reference_text ?? "")
      : null;

  return matches.map(({ document, match }): SortedWork => {
    const student = match.status === "matched" ? match.student : null;
    const unsorted = (reason: UnsortedReason): SortedWork => ({
      status: "unsorted",
      document,
      reason,
      suggestedStudentId: student?.studentId ?? null,
    });

    if (document.needs_vision && !document.body_text?.trim()) {
      return unsorted("photo");
    }
    if (match.status === "ambiguous") return unsorted("ambiguous_student");
    if (!student) return unsorted("no_student");
    if ((perStudent.get(student.studentId) ?? 0) > 1) {
      return unsorted(document.needs_vision ? "multi_page" : "duplicate_in_batch");
    }
    if (input.filedStudentIds.has(student.studentId)) {
      return unsorted("already_filed");
    }
    if (keyText === null) return unsorted("no_answer_key");

    const overlap = keyWordOverlap(keyText, document.body_text ?? "");
    if (overlap === null) return unsorted("key_too_short");
    if (overlap < MIN_KEY_OVERLAP) return unsorted("low_overlap");

    return { status: "ready", document, student, overlap };
  });
}

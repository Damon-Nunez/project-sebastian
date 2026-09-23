import type { PeriodWithRoster } from "@/lib/roster/periods";
import { matchStudentFromDocument } from "@/lib/sanitizer/match";
import type { RosterStudent } from "@/lib/sanitizer/types";

export type HomeworkMatchCandidate = {
  studentId: string;
  studentName: string;
  periodId: string;
  periodName: string;
};

export type HomeworkMatchResult =
  | { status: "matched"; student: HomeworkMatchCandidate }
  | { status: "none" }
  | { status: "ambiguous"; candidates: HomeworkMatchCandidate[] };

type RosterEntry = RosterStudent & {
  periodId: string;
  periodName: string;
};

/** Flatten period rosters so the local matcher can see every student. */
export function flattenRosterForMatch(
  periods: PeriodWithRoster[],
): RosterEntry[] {
  return periods.flatMap((period) =>
    period.students.map((student) => ({
      id: student.id,
      name: student.name,
      nickname: student.nickname,
      periodId: period.id,
      periodName: period.name,
    })),
  );
}

function toCandidate(entry: RosterEntry): HomeworkMatchCandidate {
  return {
    studentId: entry.id,
    studentName: entry.name,
    periodId: entry.periodId,
    periodName: entry.periodName,
  };
}

/**
 * Local keyword match of filename + header against all class rosters.
 * Unique hit includes the student's period so the editor can pre-select both.
 */
export function matchHomeworkToRoster(
  periods: PeriodWithRoster[],
  parts: { filename?: string | null; headerText?: string | null },
): HomeworkMatchResult {
  const flat = flattenRosterForMatch(periods);
  const byId = new Map(flat.map((entry) => [entry.id, entry]));
  const result = matchStudentFromDocument(flat, parts);

  if (result.status === "none") return { status: "none" };

  if (result.status === "matched") {
    const entry = byId.get(result.student.id);
    if (!entry) return { status: "none" };
    return { status: "matched", student: toCandidate(entry) };
  }

  const candidates = result.candidates
    .map((student) => byId.get(student.id))
    .filter((entry): entry is RosterEntry => Boolean(entry))
    .map(toCandidate);

  if (candidates.length === 0) return { status: "none" };
  if (candidates.length === 1) {
    return { status: "matched", student: candidates[0]! };
  }
  return { status: "ambiguous", candidates };
}

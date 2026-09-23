"use client";

import { useMemo, useState } from "react";
import { assignHomeworkStudentAction } from "@/app/grading/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import type { HomeworkMatchResult } from "@/lib/grading/matchHomework";

export type MatchPeriodOption = {
  id: string;
  name: string;
  students: { id: string; name: string }[];
};

type HomeworkStudentMatchFormProps = {
  documentId: string;
  periods: MatchPeriodOption[];
  match: HomeworkMatchResult;
  assignedStudentId: string | null;
  assignedPeriodId: string | null;
};

function matchBanner(match: HomeworkMatchResult): {
  tone: "ok" | "warn";
  text: string;
} {
  if (match.status === "matched") {
    return {
      tone: "ok",
      text: `Matched ${match.student.studentName} in ${match.student.periodName} from the filename or header.`,
    };
  }
  if (match.status === "ambiguous") {
    const names = match.candidates
      .map((c) => `${c.studentName} (${c.periodName})`)
      .join(", ");
    return {
      tone: "warn",
      text: `More than one roster name appeared: ${names}. Pick the right student.`,
    };
  }
  return {
    tone: "warn",
    text: "No roster name found in the filename or header. Pick a class and student.",
  };
}

export function HomeworkStudentMatchForm({
  documentId,
  periods,
  match,
  assignedStudentId,
  assignedPeriodId,
}: HomeworkStudentMatchFormProps) {
  const initialPeriodId =
    assignedPeriodId ??
    (match.status === "matched" ? match.student.periodId : "");
  const initialStudentId =
    assignedStudentId ??
    (match.status === "matched" ? match.student.studentId : "");

  const [periodId, setPeriodId] = useState(initialPeriodId);
  const [studentId, setStudentId] = useState(initialStudentId);

  const students = useMemo(
    () => periods.find((period) => period.id === periodId)?.students ?? [],
    [periodId, periods],
  );

  const banner = matchBanner(match);
  const assignedStudent = periods
    .flatMap((period) =>
      period.students.map((student) => ({
        ...student,
        periodName: period.name,
      })),
    )
    .find((student) => student.id === assignedStudentId);

  return (
    <form action={assignHomeworkStudentAction} className="space-y-4">
      <input type="hidden" name="documentId" value={documentId} />
      <p
        className={
          banner.tone === "ok"
            ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        }
      >
        {banner.text}
      </p>
      {assignedStudent ? (
        <p className="text-sm text-slate-600">
          Assigned:{" "}
          <span className="font-medium text-slate-900">
            {assignedStudent.name}
          </span>{" "}
          · {assignedStudent.periodName}
        </p>
      ) : null}
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Class
        </span>
        <select
          name="periodId"
          value={periodId}
          onChange={(event) => {
            const nextPeriod = event.target.value;
            setPeriodId(nextPeriod);
            const stillThere = periods
              .find((period) => period.id === nextPeriod)
              ?.students.some((student) => student.id === studentId);
            if (!stillThere) setStudentId("");
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
        >
          <option value="">Select a class</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Student
        </span>
        <select
          name="studentId"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          disabled={!periodId}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">
            {periodId ? "Select a student" : "Pick a class first"}
          </option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
      </label>
      <PendingSubmitButton
        idleLabel={assignedStudentId ? "Update student" : "Confirm student"}
        pendingLabel="Saving…"
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      />
    </form>
  );
}

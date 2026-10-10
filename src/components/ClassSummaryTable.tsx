"use client";

import {
  deleteFiledPaperAction,
  finalizeAllSuggestionsAction,
  finalizeSuggestionAction,
} from "@/app/grading/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { CopyTextButton } from "@/components/CopyTextButton";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import type { ClassSummaryRow } from "@/lib/grading/results";
import { useState } from "react";

const fieldClass =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none";
const copyBtnClass =
  "shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const finalBtnClass =
  "rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60";

function SummaryRow({
  row,
  periodId,
  sessionId,
}: {
  row: ClassSummaryRow;
  periodId: string;
  sessionId: string;
}) {
  const [comment, setComment] = useState(row.editableComment);
  const [grade, setGrade] = useState(row.editableGrade);

  if (row.missing) {
    return (
      <tr className="align-top">
        <td className="px-5 py-3 font-medium text-slate-900">
          {row.studentName}
        </td>
        <td className="px-5 py-3">
          <span className="font-medium text-red-700">Missing</span>
        </td>
        <td className="px-5 py-3">
          <span className="font-medium text-red-700">Missing</span>
        </td>
        <td className="px-5 py-3 text-red-700">No paper filed</td>
        <td className="px-5 py-3" />
      </tr>
    );
  }

  return (
    <tr className="align-top">
      <td className="px-5 py-3 font-medium text-slate-900">
        {row.studentName}
        {row.accommodationFlagged ? (
          <span className="mt-1 block text-xs font-normal text-amber-800">
            Accommodation noted
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <input
              name="grade"
              form={`finalize-${row.suggestionId}`}
              type="text"
              inputMode="decimal"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              aria-label={`Grade for ${row.studentName}`}
              className={`${fieldClass} w-20`}
              placeholder="0–100"
            />
            <span className="text-xs text-slate-500">%</span>
          </div>
          {row.suggestedRangeLabel && !row.isFinal ? (
            <p className="text-xs text-slate-500">
              AI range {row.suggestedRangeLabel}
            </p>
          ) : null}
        </div>
      </td>
      <td className="px-5 py-3 text-slate-700">{row.statusLabel}</td>
      <td className="px-5 py-3">
        <div className="flex items-start gap-2">
          <textarea
            name="comment"
            form={`finalize-${row.suggestionId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            aria-label={`Comment for ${row.studentName}`}
            className={`${fieldClass} min-w-48 resize-y`}
          />
          <CopyTextButton
            text={comment}
            label="Copy"
            className={copyBtnClass}
          />
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-col items-start gap-2">
        <form
          id={`finalize-${row.suggestionId}`}
          action={finalizeSuggestionAction}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="suggestionId" value={row.suggestionId ?? ""} />
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <PendingSubmitButton
            idleLabel={row.isFinal ? "Update final" : "Mark final"}
            pendingLabel="Saving…"
            className={finalBtnClass}
          />
        </form>
        <form action={deleteFiledPaperAction}>
          <input type="hidden" name="suggestionId" value={row.suggestionId ?? ""} />
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <ConfirmSubmitButton
            label="Delete paper"
            confirmMessage={`Remove ${row.studentName}'s paper from this class? This cannot be undone.`}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          />
          </form>
        </div>
      </td>
    </tr>
  );
}

export function ClassSummaryTable({
  rows,
  periodId,
  sessionId,
}: {
  rows: ClassSummaryRow[];
  periodId: string;
  sessionId: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        No students in this period yet. Add the roster before grading.
      </div>
    );
  }

  const finalizableCount = rows.filter(
    (row) => !row.missing && !row.isFinal && row.editableGrade !== "",
  ).length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Class summary
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Edit grade and comment, copy into Jupiter by hand, then mark final.
            Nothing is submitted to Jupiter automatically.
          </p>
        </div>
        {finalizableCount > 0 ? (
          <form action={finalizeAllSuggestionsAction}>
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <ConfirmSubmitButton
              label={`Finalize all (${finalizableCount})`}
              confirmMessage={`Mark ${finalizableCount} graded paper${finalizableCount === 1 ? "" : "s"} final using the current grade and comment for each?`}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            />
          </form>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-160 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Student</th>
              <th className="px-5 py-3 font-medium">Grade</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Comment</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <SummaryRow
                key={row.studentId}
                row={row}
                periodId={periodId}
                sessionId={sessionId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

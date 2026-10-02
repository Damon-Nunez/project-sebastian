"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmReadyWorkAction } from "@/app/grading/batchActions";
import { gradingErrorMessage } from "@/lib/grading/errors";

export type ReadyWorkItem = {
  documentId: string;
  filename: string;
  studentName: string;
  periodName: string;
  previewUrl: string | null;
};

export function ReadyWorkList({
  assignmentId,
  items,
}: {
  assignmentId: string;
  items: ReadyWorkItem[];
}) {
  const router = useRouter();
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = items.filter((item) => !unchecked.has(item.documentId));

  function toggle(documentId: string) {
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }

  async function confirm() {
    setBusy(true);
    setMessage(null);
    const result = await confirmReadyWorkAction({
      assignmentId,
      documentIds: selected.map((item) => item.documentId),
    }).catch(() => null);
    setBusy(false);

    if (!result?.ok) {
      setMessage(gradingErrorMessage(result?.code ?? "save_failed"));
      return;
    }
    if (result.failed > 0) {
      setMessage(
        `Filed ${result.filed}. ${result.failed} couldn't be filed — check that a rubric is set up, then try again.`,
      );
    }
    setUnchecked(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.documentId} className="flex items-center gap-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={!unchecked.has(item.documentId)}
              onChange={() => toggle(item.documentId)}
              disabled={busy}
              aria-label={`File ${item.filename}`}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-slate-900">{item.studentName}</span>
              <span className="text-slate-500"> · {item.periodName}</span>
              <span className="block truncate text-xs text-slate-500">
                {item.previewUrl ? (
                  <a
                    href={item.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {item.filename}
                  </a>
                ) : (
                  item.filename
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {message ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void confirm()}
        disabled={busy || selected.length === 0}
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Filing…" : `Confirm all (${selected.length})`}
      </button>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  gradeSuggestionAction,
  retryFailedGradingAction,
} from "@/app/grading/batchActions";

const GRADING_CONCURRENCY = 3;

/**
 * Grades every pending paper for the assignment as soon as the page has any:
 * right after filing, or when she comes back to papers left ungraded.
 */
export function GradingRunner({
  assignmentId,
  pendingIds,
  failedCount,
}: {
  assignmentId: string;
  pendingIds: string[];
  failedCount: number;
}) {
  const router = useRouter();
  const started = useRef(new Set<string>());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const queue = pendingIds.filter((id) => !started.current.has(id));
    if (queue.length === 0) return;
    for (const id of queue) started.current.add(id);

    let next = 0;
    setProgress((p) => ({ done: p?.done ?? 0, total: (p?.total ?? 0) + queue.length }));
    async function worker() {
      while (next < queue.length) {
        const suggestionId = queue[next++]!;
        await gradeSuggestionAction({ suggestionId }).catch(() => null);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }
    void Promise.all(
      Array.from({ length: Math.min(GRADING_CONCURRENCY, queue.length) }, worker),
    ).then(() => {
      setProgress((p) => (p && p.done >= p.total ? null : p));
      router.refresh();
    });
  }, [pendingIds, router]);

  async function retry() {
    setRetrying(true);
    await retryFailedGradingAction({ assignmentId }).catch(() => null);
    started.current.clear();
    setRetrying(false);
    router.refresh();
  }

  if (!progress && failedCount === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {progress ? (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-slate-800 transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Grading {progress.done} of {progress.total}… you can keep working —
            anything left ungraded picks up next time you open this page.
          </p>
        </div>
      ) : null}
      {failedCount > 0 && !progress ? (
        <div className="flex items-center justify-between gap-3 text-sm text-red-800">
          <p>
            {failedCount} {failedCount === 1 ? "paper" : "papers"} couldn&apos;t be
            graded.
          </p>
          <button
            type="button"
            disabled={retrying}
            onClick={() => void retry()}
            className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-red-50 disabled:opacity-60"
          >
            {retrying ? "Retrying…" : "Retry grading"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

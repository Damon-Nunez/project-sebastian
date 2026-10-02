import { decideVisionApprovalAction } from "@/app/grading/batchActions";
import type { RubricCriteria } from "@/lib/rubrics/criteria";
import type { Verdict } from "@/lib/grading/gradeSchema";
import { referenceKindLabel } from "@/lib/grading/reference";
import {
  AI_STATUS_LABELS,
  gradedAgainstOlderKey,
  stripAnswerMarkers,
  type SessionPaper,
} from "@/lib/grading/results";

const VERDICT_STYLES: Record<Verdict, { label: string; className: string }> = {
  correct: { label: "Correct", className: "bg-emerald-100 text-emerald-900" },
  partial: { label: "½ credit", className: "bg-amber-100 text-amber-900" },
  incorrect: { label: "Incorrect", className: "bg-red-100 text-red-900" },
  unanswered: { label: "Unanswered", className: "bg-slate-100 text-slate-700" },
  unreadable: { label: "Can't tell", className: "bg-violet-100 text-violet-900" },
};

const badge = "rounded-full px-2.5 py-0.5 text-xs font-medium";

function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function GradeResultCard({
  paper,
  criteria,
  referenceUpdatedAt,
  previewUrl,
  maskedPreviewUrls,
  periodId,
}: {
  paper: SessionPaper;
  criteria: RubricCriteria | null;
  referenceUpdatedAt: string | null;
  previewUrl: string | null;
  /** Signed URLs of the masked pages, in page order. */
  maskedPreviewUrls: string[];
  periodId: string;
}) {
  const { suggestion, detail } = paper;
  const graded = suggestion.ai_status === "graded" && detail !== null;
  const awaitingApproval = suggestion.ai_status === "awaiting_approval";
  const noNameFound = paper.visionPages.every((page) => page.nameBoxes === 0);
  const levelLabel = (level: number) =>
    criteria?.levels.find((l) => l.score === level)?.label || `Level ${level}`;
  const categoryName = (id: string) =>
    criteria?.categories.find((c) => c.id === id)?.name ?? id;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{paper.studentName}</p>
          <p className="truncate text-xs text-slate-500">
            {previewUrl ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:underline"
              >
                {paper.filename ?? "Open paper"}
              </a>
            ) : (
              (paper.filename ?? "")
            )}
          </p>
        </div>
        {graded ? (
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">
              {suggestion.suggested_range_low}–{suggestion.suggested_range_high}%
            </p>
            <p className="text-xs text-slate-500">
              {detail.mode === "points" && detail.totalPoints
                ? `${formatPoints(detail.earnedPoints ?? 0)} of ${formatPoints(detail.totalPoints)} points`
                : "From the daily rubric"}
            </p>
          </div>
        ) : (
          <span className={`${badge} bg-slate-100 text-slate-700`}>
            {suggestion.ai_status && suggestion.ai_status !== "graded"
              ? AI_STATUS_LABELS[suggestion.ai_status]
              : "Not graded"}
          </span>
        )}
      </div>

      {awaitingApproval ? (
        <div className="mt-4 space-y-3 rounded-lg border border-violet-200 bg-violet-50 p-4">
          <p className="text-sm text-violet-950">
            This is exactly what the AI will see. Check that no name or other
            identifying detail is still visible.
          </p>
          {noNameFound ? (
            <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900">
              We couldn&apos;t find a written name to black out — only the top
              strip is covered. Look closely before approving.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {maskedPreviewUrls.map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                <img
                  src={url}
                  alt={`Masked page ${index + 1}`}
                  className="h-64 w-auto rounded border border-slate-300 bg-white"
                />
              </a>
            ))}
          </div>
          <form action={decideVisionApprovalAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="suggestionId" value={suggestion.id} />
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="sessionId" value={suggestion.grading_session_id} />
            <button
              type="submit"
              name="decision"
              value="approve"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Approve &amp; grade
            </button>
            <button
              type="submit"
              name="decision"
              value="decline"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Don&apos;t send to AI
            </button>
          </form>
        </div>
      ) : null}

      {graded ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.fromImages ? (
              <span className={`${badge} bg-violet-100 text-violet-900`}>
                Graded from photo
              </span>
            ) : null}
            {detail.referenceKind === "none" ? (
              <span className={`${badge} bg-slate-100 text-slate-700`}>
                {referenceKindLabel("none")}
              </span>
            ) : null}
            {detail.referenceKind === "exemplar" ? (
              <span className={`${badge} bg-slate-100 text-slate-700`}>
                Compared to an example — no answer key
              </span>
            ) : null}
            {suggestion.accommodation_flagged ? (
              <span className={`${badge} bg-amber-100 text-amber-900`}>
                Accommodation notes considered
              </span>
            ) : null}
            {gradedAgainstOlderKey(suggestion.graded_reference_at, referenceUpdatedAt) ? (
              <span className={`${badge} bg-red-100 text-red-900`}>
                Graded against an older answer key
              </span>
            ) : null}
          </div>

          {suggestion.suggested_comment ? (
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {suggestion.suggested_comment}
            </p>
          ) : null}
          {suggestion.accommodation_flagged && detail.accommodationNote ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {detail.accommodationNote}
            </p>
          ) : null}

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-800">
              Why this range
            </summary>
            {detail.items.length > 0 ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {detail.items.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">
                        Q{item.label}
                      </span>
                      {item.kind === "key" && item.verdict ? (
                        <span className={`${badge} ${VERDICT_STYLES[item.verdict].className}`}>
                          {VERDICT_STYLES[item.verdict].label}
                        </span>
                      ) : item.rubricLevel !== null ? (
                        <span className={`${badge} bg-sky-100 text-sky-900`}>
                          Rubric {item.rubricLevel} · {levelLabel(item.rubricLevel)}
                        </span>
                      ) : null}
                      {item.maxPoints !== null ? (
                        <span className="text-xs text-slate-500">
                          {formatPoints(item.maxPoints)} pts
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-slate-700">{item.reason}</p>
                    {item.studentAnswer ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Student: “{stripAnswerMarkers(item.studentAnswer)}”
                        {item.expectedAnswer
                          ? ` · Key: “${stripAnswerMarkers(item.expectedAnswer)}”`
                          : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              {detail.categoryScores.map((score) => (
                <li key={score.categoryId} className="text-slate-700">
                  <span className="font-medium text-slate-900">
                    {categoryName(score.categoryId)}
                  </span>{" "}
                  — {score.level} · {levelLabel(score.level)}. {score.reason}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              {detail.mode === "points"
                ? "Points come from the answer key; ½ credit is noted per question. Range is the score ±2."
                : "No points on the key, so the rubric levels above set the grade. Range is the score ±2."}
            </p>
          </details>
        </>
      ) : null}
    </li>
  );
}

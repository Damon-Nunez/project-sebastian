import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteAssignmentFolderButton } from "@/components/DeleteAssignmentFolderButton";
import { GradeResultCard } from "@/components/GradeResultCard";
import { GradingRunner } from "@/components/GradingRunner";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { getAssignmentForTeacher } from "@/lib/grading/assignments";
import { gradingErrorMessage } from "@/lib/grading/errors";
import { listGradingQueueForAssignment, loadRubric } from "@/lib/grading/gradeWork";
import { listSessionPapers } from "@/lib/grading/results";
import {
  getGradingSessionForTeacher,
  sessionFolderTitle,
} from "@/lib/grading/sessions";
import { createSignedStudentWorkUrls } from "@/lib/grading/upload";
import { getPeriodForTeacher } from "@/lib/roster/periods";
import { safeParseRubricCriteria } from "@/lib/rubrics/criteria";

type SessionPageProps = {
  params: Promise<{ periodId: string; sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function GradingSessionPage({
  params,
  searchParams,
}: SessionPageProps) {
  const teacher = await getCurrentTeacher();
  const { periodId, sessionId } = await params;
  const { error } = await searchParams;

  const [period, session] = await Promise.all([
    getPeriodForTeacher(teacher.id, periodId),
    getGradingSessionForTeacher({ teacherId: teacher.id, sessionId }),
  ]);

  if (!period || !session || session.section_id !== periodId) {
    notFound();
  }

  const [papers, assignment, rubric] = await Promise.all([
    listSessionPapers({ teacherId: teacher.id, sessionId }),
    session.assignment_id
      ? getAssignmentForTeacher({
          teacherId: teacher.id,
          assignmentId: session.assignment_id,
        })
      : null,
    loadRubric(teacher.id, session.rubric_id),
  ]);
  const parsedCriteria = rubric ? safeParseRubricCriteria(rubric.criteria) : null;
  const criteria = parsedCriteria?.success ? parsedCriteria.data : null;
  const previewUrls = await createSignedStudentWorkUrls(
    papers.flatMap((paper) => [
      ...(paper.storagePath ? [paper.storagePath] : []),
      ...(paper.suggestion.ai_status === "awaiting_approval"
        ? paper.visionPages.map((page) => page.maskedPath)
        : []),
    ]),
  );
  const errorMessage = gradingErrorMessage(error);
  const gradingQueue = assignment
    ? await listGradingQueueForAssignment({
        teacherId: teacher.id,
        assignmentId: assignment.id,
      })
    : null;

  const title = sessionFolderTitle(session);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          <Link href="/grading" className="hover:text-slate-800">
            Grading
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <Link
            href={`/grading/${periodId}`}
            className="hover:text-slate-800"
          >
            {period.name}
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          {title}
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          <DeleteAssignmentFolderButton
            sessionId={session.id}
            periodId={periodId}
            folderTitle={title}
            variant="button"
          />
        </div>
        <p className="mt-3">
          <Link
            href={
              assignment
                ? `/grading/assignments/${assignment.id}`
                : `/grading/${periodId}`
            }
            className="text-sm font-medium text-slate-800 underline-offset-2 hover:underline"
          >
            ←{" "}
            {assignment
              ? "Back to assignment"
              : `Back to ${period.name}`}
          </Link>
        </p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          {period.name}&apos;s papers for this assignment. Suggested ranges are
          a starting point — you set the final grade.
        </p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Type
            </dt>
            <dd className="mt-1 text-slate-900">
              {session.assignment_type.replace("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status
            </dt>
            <dd className="mt-1 text-slate-900">{session.status}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Updated
            </dt>
            <dd className="mt-1 text-slate-900">
              {new Date(session.updated_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {errorMessage ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {assignment && gradingQueue ? (
        <GradingRunner
          assignmentId={assignment.id}
          pendingIds={gradingQueue.pendingIds}
          failedCount={gradingQueue.failedIds.length}
        />
      ) : null}

      {papers.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No papers filed in this folder yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {papers.map((paper) => (
            <GradeResultCard
              key={paper.suggestion.id}
              paper={paper}
              criteria={criteria}
              referenceUpdatedAt={assignment?.reference_updated_at ?? null}
              previewUrl={
                (paper.storagePath && previewUrls.get(paper.storagePath)) ?? null
              }
              maskedPreviewUrls={paper.visionPages.flatMap((page) => {
                const url = previewUrls.get(page.maskedPath);
                return url ? [url] : [];
              })}
              periodId={periodId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

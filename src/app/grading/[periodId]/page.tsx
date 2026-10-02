import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteAssignmentFolderButton } from "@/components/DeleteAssignmentFolderButton";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { gradingErrorMessage } from "@/lib/grading/errors";
import {
  listGradingSessionsForPeriod,
  sessionFolderTitle,
} from "@/lib/grading/sessions";
import { getPeriodForTeacher } from "@/lib/roster/periods";

type PeriodGradingPageProps = {
  params: Promise<{ periodId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function PeriodGradingPage({
  params,
  searchParams,
}: PeriodGradingPageProps) {
  const teacher = await getCurrentTeacher();
  const { periodId } = await params;
  const { error } = await searchParams;

  const period = await getPeriodForTeacher(teacher.id, periodId);
  if (!period) notFound();

  const sessions = await listGradingSessionsForPeriod({
    teacherId: teacher.id,
    sectionId: periodId,
  });
  const errorMessage = gradingErrorMessage(error);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          <Link href="/grading" className="hover:text-slate-800">
            Grading
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          Past work
          <span className="mx-2 text-slate-300">/</span>
          {period.name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          {period.name}
        </h1>
        <p className="mt-3">
          <Link
            href="/grading"
            className="text-sm font-medium text-slate-800 underline-offset-2 hover:underline"
          >
            ← Back to grading
          </Link>
        </p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Saved assignment folders for this class. New work starts from the
          Assignments list on Grading — folders appear here after you file.
        </p>
      </div>

      {errorMessage ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Saved assignment folders
        </h2>
        {sessions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Nothing saved for this class yet. Upload a homework file from
            Grading; on save it lands under the M1U1L1-HW folder you set in
            the editor.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {sessions.map((session) => {
              const title = sessionFolderTitle(session);
              return (
                <li key={session.id} className="flex items-center gap-2 py-2">
                  <Link
                    href={`/grading/${periodId}/${session.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-md px-2 py-2 text-sm transition hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {title}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-slate-500">
                        {session.assignment_type.replace("_", " ")} ·{" "}
                        {session.status}
                      </span>
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {new Date(session.updated_at).toLocaleDateString()}
                    </span>
                  </Link>
                  <DeleteAssignmentFolderButton
                    sessionId={session.id}
                    periodId={periodId}
                    folderTitle={title}
                    variant="icon"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

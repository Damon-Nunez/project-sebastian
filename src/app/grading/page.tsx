import Link from "next/link";
import { DeleteAssignmentButton } from "@/components/DeleteAssignmentButton";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { listAssignmentsForTeacher } from "@/lib/grading/assignments";
import { gradingErrorMessage } from "@/lib/grading/errors";
import { formatAssignmentFolderTitle } from "@/lib/grading/labels";
import { referenceKindLabel } from "@/lib/grading/reference";
import { listPeriodsForTeacher } from "@/lib/roster/periods";

type GradingPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function GradingPage({ searchParams }: GradingPageProps) {
  const teacher = await getCurrentTeacher();
  const [periods, assignments, { error }] = await Promise.all([
    listPeriodsForTeacher(teacher.id),
    listAssignmentsForTeacher(teacher.id),
    searchParams,
  ]);
  const errorMessage = gradingErrorMessage(error);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Grading
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Grade homework
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Open an assignment (or create one), add its answer key, then drop the
          whole class&apos;s homework in. We match each file to a student and
          you confirm before anything is filed.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Need a scoring guide first?{" "}
          <Link
            href="/rubrics"
            className="font-medium text-slate-800 underline-offset-2 hover:underline"
          >
            Rubrics setup
          </Link>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Assignments</h2>
            <p className="mt-1 text-sm text-slate-600">
              One per M/U/L — the answer key is shared by every period.
            </p>
          </div>
          <Link
            href="/grading/assignments/new"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New assignment
          </Link>
        </div>
        {assignments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No assignments yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {assignments.map((assignment) => {
              const title = formatAssignmentFolderTitle(
                assignment,
                assignment.title,
                assignment.assignment_type,
              );
              return (
                <li
                  key={assignment.id}
                  className="flex items-center gap-2 py-2"
                >
                  <Link
                    href={`/grading/assignments/${assignment.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-md px-2 py-2 text-sm transition hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {title}
                      </span>
                      {assignment.title ? (
                        <span className="text-xs text-slate-500">
                          {formatAssignmentFolderTitle(
                            assignment,
                            null,
                            assignment.assignment_type,
                          )}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={
                        assignment.reference_updated_at === null
                          ? "shrink-0 text-amber-700"
                          : "shrink-0 text-slate-500"
                      }
                    >
                      {assignment.reference_updated_at === null
                        ? "Needs answer key"
                        : referenceKindLabel(assignment.reference_kind)}
                    </span>
                  </Link>
                  <DeleteAssignmentButton
                    assignmentId={assignment.id}
                    assignmentTitle={title}
                    variant="icon"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Past work by class
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          After you file, papers live under the period → M1U1L1-HW path.
          Browse here when you need something back.
        </p>
        {periods.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No classes yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {periods.map((period) => (
              <li key={period.id}>
                <Link
                  href={`/grading/${period.id}`}
                  className="flex items-center justify-between gap-4 py-3 text-sm transition hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">
                    {period.name}
                  </span>
                  <span className="text-slate-500">Browse</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

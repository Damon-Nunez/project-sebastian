import Link from "next/link";
import { HomeworkUploadForm } from "@/components/HomeworkUploadForm";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { gradingErrorMessage } from "@/lib/grading/errors";
import { listPeriodsForTeacher } from "@/lib/roster/periods";

type GradingPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function GradingPage({ searchParams }: GradingPageProps) {
  const teacher = await getCurrentTeacher();
  const periods = await listPeriodsForTeacher(teacher.id);
  const { error } = await searchParams;
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
          Upload a student file first. We detect the name, match the period from
          your roster, then you confirm the student and save into an M1U1L1-HW
          folder. How the work is shown and graded comes next.
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Upload homework
          </h2>
          {periods.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No periods yet.{" "}
              <Link
                href="/periods"
                className="font-medium text-slate-800 underline-offset-2 hover:underline"
              >
                Set up periods
              </Link>{" "}
              so we can match students to a class.
            </p>
          ) : (
            <HomeworkUploadForm />
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Past work by class
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            After you save, files live under the period → M1U1L1-HW path.
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
      </div>
    </section>
  );
}

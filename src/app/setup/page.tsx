import Link from "next/link";
import { finishSetupAction, saveWelcomeAction } from "@/app/setup/actions";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  CORE_SUBJECTS,
  coreSubjectOrEmpty,
  GRADE_BANDS,
  gradeBandOrEmpty,
  HONORIFICS,
} from "@/lib/auth/teacherHeader";
import { loadSetupProgress } from "@/lib/setup/loadSetupProgress";

type SetupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  welcome: "Enter your name and honorific, then choose a subject and grade.",
  incomplete: "Finish welcome, a class with a student, and the daily rubric first.",
};

const fieldClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500";

function StepBadge({ done }: { done: boolean }) {
  return (
    <span
      className={
        done
          ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
          : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
      }
    >
      {done ? "Done" : "Still needed"}
    </span>
  );
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const teacher = await getCurrentTeacher();
  const progress = await loadSetupProgress(teacher);
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;
  const honorificOptions = HONORIFICS.includes(
    progress.honorific as (typeof HONORIFICS)[number],
  )
    ? HONORIFICS
    : progress.honorific
      ? ([progress.honorific, ...HONORIFICS] as string[])
      : HONORIFICS;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Sebastian
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Welcome
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Confirm the name from Google, then add a class and a daily rubric.
          You can leave and come back — this page keeps your place.
        </p>
        {errorMessage ? (
          <p
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            1. Name, subject, and grade
          </h2>
          <StepBadge done={progress.profileReady} />
        </div>
        <form action={saveWelcomeAction} className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Google email
            </span>
            <input
              value={progress.email ?? ""}
              readOnly
              className={`${fieldClass} bg-slate-50 text-slate-600`}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Display name
            </span>
            <input
              name="displayName"
              required
              defaultValue={progress.displayName}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Honorific
            </span>
            <select
              name="honorific"
              required
              defaultValue={progress.honorific}
              className={fieldClass}
            >
              <option value="">Choose one</option>
              {honorificOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Subject
            </span>
            <select
              name="subject"
              required
              defaultValue={coreSubjectOrEmpty(progress.subject)}
              className={fieldClass}
            >
              <option value="">Choose one</option>
              {CORE_SUBJECTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Grade
            </span>
            <select
              name="gradeLabel"
              required
              defaultValue={gradeBandOrEmpty(progress.gradeLabel)}
              className={fieldClass}
            >
              <option value="">Choose one</option>
              {GRADE_BANDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save welcome
          </button>
        </form>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            2. Period and roster
          </h2>
          <StepBadge done={progress.rosterReady} />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Add one class period and at least one student. Notes on a student
          are optional.
        </p>
        <Link
          href="/periods"
          className="mt-4 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Set up periods
        </Link>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            3. Daily rubric
          </h2>
          <StepBadge done={progress.rubricReady} />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The daily homework rubric is required. Essay rubrics can wait.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/rubrics/daily"
            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Daily rubric
          </Link>
          <Link
            href="/units"
            className="inline-flex rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Essay rubrics (optional)
          </Link>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          4. Enter the app
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          When the three steps above are done, this opens your home page.
        </p>
        <form action={finishSetupAction} className="mt-4">
          <button
            type="submit"
            disabled={!progress.minimumMet}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enter app
          </button>
        </form>
      </article>
    </section>
  );
}

import { FrameworkUploadForm } from "@/components/FrameworkUploadForm";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { lessonErrorMessage } from "@/lib/lessons/errors";
import { listLessonPlansForTeacher } from "@/lib/lessons/plans";
import type { LessonPlanRow } from "@/lib/db/types";
import Link from "next/link";

function planTitle(plan: LessonPlanRow): string {
  const bits = [
    plan.module_label ? `Module ${plan.module_label}` : null,
    plan.unit_label ? `Unit ${plan.unit_label}` : null,
    plan.lesson_label ? `Lesson ${plan.lesson_label}` : null,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : "Untitled draft";
}

type LessonsPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LessonsPage({ searchParams }: LessonsPageProps) {
  const teacher = await getCurrentTeacher();
  const plans = await listLessonPlansForTeacher(teacher.id);
  const { error } = await searchParams;
  const errorMessage = lessonErrorMessage(error);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Lesson planning
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Lessons
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Upload a district framework (.docx or .pdf). We pre-fill the formula
          sections into a draft you can review and edit.
        </p>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Your drafts</h2>
          {plans.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No lesson drafts yet. Upload a framework on the right to start.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <Link
                    href={`/lessons/${plan.id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm transition hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">
                      {planTitle(plan)}
                    </span>
                    <span className="capitalize text-slate-500">
                      {plan.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Upload framework
          </h2>
          <FrameworkUploadForm />
        </div>
      </div>
    </section>
  );
}

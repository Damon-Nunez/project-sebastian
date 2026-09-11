import { DeleteLessonDraftButton } from "@/components/DeleteLessonDraftButton";
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

function PlanList({
  plans,
  emptyMessage,
}: {
  plans: LessonPlanRow[];
  emptyMessage: string;
}) {
  if (plans.length === 0) {
    return <p className="mt-4 text-sm text-slate-600">{emptyMessage}</p>;
  }

  return (
    <ul className="mt-4 divide-y divide-slate-100">
      {plans.map((plan) => {
        const title = planTitle(plan);
        return (
          <li key={plan.id} className="flex items-center gap-2 py-2">
            <Link
              href={`/lessons/${plan.id}`}
              className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-md px-2 py-2 text-sm transition hover:bg-slate-50"
            >
              <span className="truncate font-medium text-slate-900">
                {title}
              </span>
              <span className="shrink-0 text-slate-500">
                {new Date(plan.updated_at).toLocaleDateString()}
              </span>
            </Link>
            <DeleteLessonDraftButton
              lessonId={plan.id}
              draftTitle={title}
              variant="icon"
            />
          </li>
        );
      })}
    </ul>
  );
}

type LessonsPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LessonsPage({ searchParams }: LessonsPageProps) {
  const teacher = await getCurrentTeacher();
  const plans = await listLessonPlansForTeacher(teacher.id);
  const drafts = plans.filter((plan) => plan.status === "draft");
  const finished = plans.filter((plan) => plan.status === "final");
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
          sections into a draft you can review, edit, and mark finished.
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
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Drafts</h2>
            <PlanList
              plans={drafts}
              emptyMessage="No open drafts. Upload a framework on the right to start."
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Finished</h2>
            <p className="mt-1 text-xs text-slate-500">
              Sebastian local save — finished plans stay here until you reopen
              them.
            </p>
            <PlanList
              plans={finished}
              emptyMessage="No finished plans yet. Open a draft and choose Mark finished."
            />
          </div>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonPlanEditor } from "@/components/LessonPlanEditor";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { parseLessonPlanContent } from "@/lib/lessons/content";
import { lessonErrorMessage } from "@/lib/lessons/errors";
import { getLessonPlanForTeacher } from "@/lib/lessons/plans";

type LessonPageProps = {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function LessonDetailPage({
  params,
  searchParams,
}: LessonPageProps) {
  const { lessonId } = await params;
  const { saved, error } = await searchParams;
  const errorMessage = lessonErrorMessage(error);
  const teacher = await getCurrentTeacher();
  const plan = await getLessonPlanForTeacher(teacher.id, lessonId);

  if (!plan) {
    notFound();
  }

  const content = parseLessonPlanContent(plan.content);
  const titleBits = [
    plan.module_label ? `Module ${plan.module_label}` : null,
    plan.unit_label ? `Unit ${plan.unit_label}` : null,
    plan.lesson_label ? `Lesson ${plan.lesson_label}` : null,
  ].filter(Boolean);
  const draftTitle =
    titleBits.length > 0 ? titleBits.join(" · ") : "Untitled draft";

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          <Link href="/lessons" className="hover:text-slate-800">
            Lessons
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          Draft
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          {draftTitle === "Untitled draft" ? "Lesson draft" : draftTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Left: live lesson preview and what came from the upload. Right: edit
          fields (Work Time bodies are yours). Save when it looks right.
        </p>
      </div>

      {saved ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Draft saved.
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {errorMessage}
        </p>
      ) : null}

      <LessonPlanEditor
        lessonId={plan.id}
        draftTitle={draftTitle}
        initialContent={content}
        initialFreeTextAsks={plan.free_text_asks ?? ""}
        initialModuleLabel={plan.module_label ?? ""}
        initialUnitLabel={plan.unit_label ?? ""}
        initialLessonLabel={plan.lesson_label ?? ""}
      />
    </section>
  );
}

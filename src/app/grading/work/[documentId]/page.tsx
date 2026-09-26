import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeworkEditorForm } from "@/components/HomeworkEditorForm";
import { HomeworkStudentMatchForm } from "@/components/HomeworkStudentMatchForm";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { gradingErrorMessage } from "@/lib/grading/errors";
import { headerTextForMatch } from "@/lib/grading/headerText";
import { matchHomeworkToRoster } from "@/lib/grading/matchHomework";
import {
  createSignedStudentWorkUrl,
  getStudentWorkForTeacher,
} from "@/lib/grading/upload";
import { resolveLessonLabels } from "@/lib/lessons/labels";
import { listPeriodsWithRostersForTeacher } from "@/lib/roster/periods";

type WorkPageProps = {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function HomeworkWorkPage({
  params,
  searchParams,
}: WorkPageProps) {
  const teacher = await getCurrentTeacher();
  const { documentId } = await params;
  const { error } = await searchParams;

  const [document, periods] = await Promise.all([
    getStudentWorkForTeacher({
      teacherId: teacher.id,
      documentId,
    }),
    listPeriodsWithRostersForTeacher(teacher.id),
  ]);

  if (!document) notFound();

  const originalUrl = document.storage_path
    ? await createSignedStudentWorkUrl(document.storage_path)
    : null;
  const isPhoto = document.storage_path?.toLowerCase().endsWith(".jpg") ?? false;

  const match = matchHomeworkToRoster(periods, {
    filename: document.original_filename,
    headerText: headerTextForMatch(document.body_text ?? ""),
  });
  const assignedPeriodId = document.student_id
    ? (periods.find((period) =>
        period.students.some((student) => student.id === document.student_id),
      )?.id ?? null)
    : null;
  const guessed = resolveLessonLabels({
    text: document.body_text ?? "",
    filename: document.original_filename ?? "",
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
          Upload
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Confirm student
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Match this file to a student, set M / U / L, and save it into that
          class folder. How the work is shown and graded comes in Ticket 10.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Source:{" "}
          <span className="font-medium text-slate-800">
            {document.original_filename ?? "uploaded file"}
          </span>
          {originalUrl && !isPhoto ? (
            <>
              {" · "}
              <a
                href={originalUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-slate-800 underline-offset-2 hover:underline"
              >
                Open original
              </a>
            </>
          ) : null}
        </p>
        {document.needs_vision ? (
          <p className="mt-2 text-sm text-amber-700">
            No readable text in this file — it will be graded from the image.
          </p>
        ) : null}
        {originalUrl && isPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img
            src={originalUrl}
            alt="Uploaded homework"
            className="mt-4 max-h-[32rem] rounded-lg border border-slate-200"
          />
        ) : null}
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
        <h2 className="text-sm font-semibold text-slate-900">Student</h2>
        <p className="mt-2 text-sm text-slate-600">
          Matched from the filename or the top of the document. Change it if
          it&apos;s wrong.
        </p>
        {periods.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No periods yet.{" "}
            <Link
              href="/periods"
              className="font-medium text-slate-800 underline-offset-2 hover:underline"
            >
              Set up periods
            </Link>{" "}
            so we can match this file to a student.
          </p>
        ) : (
          <div className="mt-4">
            <HomeworkStudentMatchForm
              documentId={document.id}
              periods={periods.map((period) => ({
                id: period.id,
                name: period.name,
                students: period.students.map((student) => ({
                  id: student.id,
                  name: student.name,
                })),
              }))}
              match={match}
              assignedStudentId={document.student_id}
              assignedPeriodId={assignedPeriodId}
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Assignment folder
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          On save we find or create{" "}
          <span className="font-medium text-slate-800">M#U#L#-HW</span> under
          this student&apos;s class.
        </p>
        <div className="mt-4">
          <HomeworkEditorForm
            documentId={document.id}
            canSave={Boolean(document.student_id)}
            defaultModuleLabel={guessed.module_label ?? ""}
            defaultUnitLabel={guessed.unit_label ?? ""}
            defaultLessonLabel={guessed.lesson_label ?? ""}
          />
        </div>
      </div>
    </section>
  );
}

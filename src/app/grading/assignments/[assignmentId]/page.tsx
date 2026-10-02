import Link from "next/link";
import { notFound } from "next/navigation";
import {
  combineUnfiledPagesAction,
  fileUnsortedWorkAction,
  removeUnfiledWorkAction,
} from "@/app/grading/batchActions";
import { AssignmentReferenceForm } from "@/components/AssignmentReferenceForm";
import { BatchUploadDropzone } from "@/components/BatchUploadDropzone";
import { DeleteAssignmentButton } from "@/components/DeleteAssignmentButton";
import { GradingRunner } from "@/components/GradingRunner";
import { ReadyWorkList } from "@/components/ReadyWorkList";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  getAssignmentForTeacher,
  listPeriodFoldersForAssignment,
} from "@/lib/grading/assignments";
import { loadAssignmentBatch } from "@/lib/grading/batch";
import { UNSORTED_REASON_LABELS } from "@/lib/grading/batchSort";
import { gradingErrorMessage } from "@/lib/grading/errors";
import { listGradingQueueForAssignment } from "@/lib/grading/gradeWork";
import { formatAssignmentFolderTitle } from "@/lib/grading/labels";
import { referenceKindLabel } from "@/lib/grading/reference";
import { parseVisionPages } from "@/lib/grading/studentWorkFiles";
import { createSignedStudentWorkUrls } from "@/lib/grading/upload";

type AssignmentPageProps = {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AssignmentPage({
  params,
  searchParams,
}: AssignmentPageProps) {
  const teacher = await getCurrentTeacher();
  const { assignmentId } = await params;
  const { error } = await searchParams;

  const assignment = await getAssignmentForTeacher({
    teacherId: teacher.id,
    assignmentId,
  });
  if (!assignment) notFound();

  const [folders, { periods, sorted }, gradingQueue] = await Promise.all([
    listPeriodFoldersForAssignment({
      teacherId: teacher.id,
      assignmentId,
    }),
    loadAssignmentBatch({ teacherId: teacher.id, assignment }),
    listGradingQueueForAssignment({ teacherId: teacher.id, assignmentId }),
  ]);
  const previewUrls = await createSignedStudentWorkUrls(
    sorted.flatMap((item) =>
      item.document.storage_path ? [item.document.storage_path] : [],
    ),
  );
  const previewFor = (storagePath: string | null) =>
    (storagePath && previewUrls.get(storagePath)) ?? null;
  const ready = sorted.flatMap((item) =>
    item.status === "ready"
      ? [
          {
            documentId: item.document.id,
            filename: item.document.original_filename ?? "homework",
            studentName: item.student.studentName,
            periodName: item.student.periodName,
            previewUrl: previewFor(item.document.storage_path),
          },
        ]
      : [],
  );
  const unsorted = sorted.flatMap((item) =>
    item.status === "unsorted" ? [item] : [],
  );
  const combinable = sorted.filter(
    (item) =>
      item.document.needs_vision &&
      parseVisionPages(item.document.vision_pages).length > 0,
  );
  const errorMessage = gradingErrorMessage(error);

  const title = formatAssignmentFolderTitle(
    assignment,
    assignment.title,
    assignment.assignment_type,
  );
  const mulLabel = formatAssignmentFolderTitle(
    assignment,
    null,
    assignment.assignment_type,
  );
  const referenceSet = assignment.reference_updated_at !== null;
  const initialKind = referenceSet
    ? assignment.reference_kind
    : assignment.assignment_type === "essay"
      ? "exemplar"
      : "answer_key";

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          <Link href="/grading" className="hover:text-slate-800">
            Grading
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          {title}
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            {assignment.title ? (
              <p className="mt-1 text-sm text-slate-500">{mulLabel}</p>
            ) : null}
          </div>
          <DeleteAssignmentButton
            assignmentId={assignment.id}
            assignmentTitle={title}
            variant="button"
          />
        </div>
        <p className="mt-3 text-sm">
          {!referenceSet ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
              Add an answer key or example below
            </span>
          ) : assignment.reference_kind === "none" ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              {referenceKindLabel("none")}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-900">
              {referenceKindLabel(assignment.reference_kind)} saved
            </span>
          )}
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
        <h2 className="text-sm font-semibold text-slate-900">Upload homework</h2>
        <p className="mt-2 text-sm text-slate-600">
          We match each file to a student and check it against the answer key.
          Nothing is filed until you confirm.
        </p>
        <div className="mt-4">
          {periods.length === 0 ? (
            <p className="text-sm text-slate-600">
              No periods yet.{" "}
              <Link
                href="/periods"
                className="font-medium text-slate-800 underline-offset-2 hover:underline"
              >
                Set up periods
              </Link>{" "}
              so we can match files to students.
            </p>
          ) : (
            <BatchUploadDropzone assignmentId={assignment.id} />
          )}
        </div>
      </div>

      <GradingRunner
        assignmentId={assignment.id}
        pendingIds={gradingQueue.pendingIds}
        failedCount={gradingQueue.failedIds.length}
      />

      {gradingQueue.awaitingApproval > 0 ? (
        <p className="rounded-xl border border-violet-200 bg-violet-50 px-6 py-4 text-sm text-violet-950">
          {gradingQueue.awaitingApproval}{" "}
          {gradingQueue.awaitingApproval === 1 ? "photo is" : "photos are"} waiting
          for you to check the masked preview. Open the period folder below to
          approve them for grading.
        </p>
      ) : null}

      {combinable.length >= 2 ? (
        <form
          action={combineUnfiledPagesAction}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <h2 className="text-sm font-semibold text-slate-900">
            Several photos of one paper?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Check the pages that belong together, then combine. Pages go in
            file-name order.
          </p>
          <ul className="mt-4 flex flex-wrap gap-4">
            {combinable.map((item) => {
              const previewUrl = item.document.storage_path
                ?.toLowerCase()
                .endsWith(".jpg")
                ? previewFor(item.document.storage_path)
                : null;
              const pageCount = parseVisionPages(item.document.vision_pages).length;
              return (
                <li key={item.document.id}>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="combineIds"
                      value={item.document.id}
                      defaultChecked={
                        item.status === "unsorted" && item.reason === "multi_page"
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {previewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-16 w-12 rounded border border-slate-200 object-cover"
                      />
                    ) : null}
                    <span>
                      {item.document.original_filename ?? "photo"}
                      {pageCount > 1 ? ` (${pageCount} pages)` : ""}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="submit"
            className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Combine checked photos
          </button>
        </form>
      ) : null}

      {ready.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Ready to file ({ready.length})
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Clean student match and it lines up with the answer key. Uncheck
            anything that looks wrong.
          </p>
          <div className="mt-4">
            <ReadyWorkList
              key={ready.map((item) => item.documentId).join(",")}
              assignmentId={assignment.id}
              items={ready}
            />
          </div>
        </div>
      ) : null}

      {unsorted.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Unsorted ({unsorted.length})
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Pick the student for each one, then file it.
          </p>
          <ul className="mt-4 divide-y divide-slate-100">
            {unsorted.map((item) => {
              const previewUrl = previewFor(item.document.storage_path);
              const isPhoto =
                item.document.storage_path?.toLowerCase().endsWith(".jpg") ??
                false;
              const pageCount = parseVisionPages(item.document.vision_pages).length;
              return (
                <li
                  key={item.document.id}
                  className="flex flex-wrap items-center gap-4 py-3 text-sm"
                >
                  {previewUrl && isPhoto ? (
                    <a href={previewUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-16 w-12 rounded border border-slate-200 object-cover"
                      />
                    </a>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {previewUrl ? (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline-offset-2 hover:underline"
                        >
                          {item.document.original_filename ?? "homework"}
                        </a>
                      ) : (
                        (item.document.original_filename ?? "homework")
                      )}
                    </p>
                    <p className="text-xs text-amber-800">
                      {UNSORTED_REASON_LABELS[item.reason]}
                      {pageCount > 1 ? ` · ${pageCount} pages` : ""}
                    </p>
                  </div>
                  <form
                    action={fileUnsortedWorkAction}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <input type="hidden" name="documentId" value={item.document.id} />
                    <select
                      name="studentId"
                      defaultValue={item.suggestedStudentId ?? ""}
                      aria-label="Student"
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Pick a student…</option>
                      {periods.map((period) => (
                        <optgroup key={period.id} label={period.name}>
                          {period.students.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      File
                    </button>
                    <button
                      type="submit"
                      formAction={removeUnfiledWorkAction}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Answer key or example
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Shared by every period&apos;s {title} folder.
          </p>
          <div className="mt-4">
            <AssignmentReferenceForm
              key={assignment.reference_updated_at ?? "unset"}
              assignmentId={assignment.id}
              initialKind={initialKind}
              initialText={assignment.reference_text ?? ""}
              currentFilename={assignment.reference_filename}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Period folders</h2>
          {folders.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No student work filed yet. A period&apos;s folder is created the
              first time you file a paper for one of its students.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {folders.map((folder) => (
                <li key={folder.session.id}>
                  <Link
                    href={`/grading/${folder.session.section_id}/${folder.session.id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm transition hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">
                      {folder.periodName}
                    </span>
                    <span className="text-slate-500">
                      {folder.documentCount}{" "}
                      {folder.documentCount === 1 ? "paper" : "papers"}
                    </span>
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

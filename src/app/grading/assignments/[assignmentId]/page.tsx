import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentReferenceForm } from "@/components/AssignmentReferenceForm";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  getAssignmentForTeacher,
  listPeriodFoldersForAssignment,
} from "@/lib/grading/assignments";
import { formatAssignmentFolderTitle } from "@/lib/grading/labels";
import { referenceKindLabel } from "@/lib/grading/reference";

type AssignmentPageProps = {
  params: Promise<{ assignmentId: string }>;
};

export default async function AssignmentPage({ params }: AssignmentPageProps) {
  const teacher = await getCurrentTeacher();
  const { assignmentId } = await params;

  const assignment = await getAssignmentForTeacher({
    teacherId: teacher.id,
    assignmentId,
  });
  if (!assignment) notFound();

  const folders = await listPeriodFoldersForAssignment({
    teacherId: teacher.id,
    assignmentId,
  });

  const title = formatAssignmentFolderTitle(
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
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
              No student work yet. Folders appear here as you file homework
              for each period.
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

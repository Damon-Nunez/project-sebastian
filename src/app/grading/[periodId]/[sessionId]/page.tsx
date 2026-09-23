import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteAssignmentFolderButton } from "@/components/DeleteAssignmentFolderButton";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  getGradingSessionForTeacher,
  sessionFolderTitle,
} from "@/lib/grading/sessions";
import { getPeriodForTeacher } from "@/lib/roster/periods";

type SessionPageProps = {
  params: Promise<{ periodId: string; sessionId: string }>;
};

export default async function GradingSessionPage({ params }: SessionPageProps) {
  const teacher = await getCurrentTeacher();
  const { periodId, sessionId } = await params;

  const [period, session] = await Promise.all([
    getPeriodForTeacher(teacher.id, periodId),
    getGradingSessionForTeacher({ teacherId: teacher.id, sessionId }),
  ]);

  if (!period || !session || session.section_id !== periodId) {
    notFound();
  }

  const title = sessionFolderTitle(session);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          <Link href="/grading" className="hover:text-slate-800">
            Grading
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <Link
            href={`/grading/${periodId}`}
            className="hover:text-slate-800"
          >
            {period.name}
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          {title}
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          <DeleteAssignmentFolderButton
            sessionId={session.id}
            periodId={periodId}
            folderTitle={title}
            variant="button"
          />
        </div>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Saved folder for {period.name}. New uploads still start from Grading →
          Upload. AI grading comes later.
        </p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Type
            </dt>
            <dd className="mt-1 text-slate-900">
              {session.assignment_type.replace("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status
            </dt>
            <dd className="mt-1 text-slate-900">{session.status}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Updated
            </dt>
            <dd className="mt-1 text-slate-900">
              {new Date(session.updated_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

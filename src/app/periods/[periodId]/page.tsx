import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createStudentAction,
  deletePeriodAction,
  deleteStudentAction,
  updatePeriodAction,
  updateStudentAction,
} from "@/app/periods/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { getPeriodForTeacher } from "@/lib/roster/periods";
import { listStudentsForPeriod } from "@/lib/roster/students";

type PeriodDetailPageProps = {
  params: Promise<{ periodId: string }>;
};

const cellInputClass =
  "w-full min-w-0 rounded border border-transparent bg-transparent px-2 py-1.5 text-sm text-slate-900 outline-none hover:border-slate-200 focus:border-slate-400 focus:bg-white";

const rosterGridClass =
  "grid grid-cols-[minmax(9rem,1.2fr)_minmax(6rem,0.7fr)_minmax(9rem,1.1fr)_4.5rem_4rem] items-center gap-1";

export default async function PeriodDetailPage({
  params,
}: PeriodDetailPageProps) {
  const { periodId } = await params;
  const teacher = await getCurrentTeacher();
  const period = await getPeriodForTeacher(teacher.id, periodId);

  if (!period) {
    notFound();
  }

  const students = await listStudentsForPeriod({
    teacherId: teacher.id,
    periodId: period.id,
  });

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/periods"
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← All periods
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {period.name}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {period.school_year
            ? `School year ${period.school_year}`
            : "No school year set"}{" "}
          · {students.length} student{students.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Roster</h2>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[42rem]">
              <div
                className={`${rosterGridClass} border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500`}
              >
                <span>Student name</span>
                <span>Nickname</span>
                <span>Notes</span>
                <span className="sr-only">Save</span>
                <span className="sr-only">Remove</span>
              </div>

              {students.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-600">
                  No students yet. Add a full name below — nickname and notes are
                  optional.
                </p>
              ) : (
                <ul>
                  {students.map((student) => (
                    <li
                      key={student.id}
                      className={`${rosterGridClass} border-b border-slate-100 px-2 py-0.5 last:border-b-0`}
                    >
                      <form action={updateStudentAction} className="contents">
                        <input type="hidden" name="periodId" value={period.id} />
                        <input
                          type="hidden"
                          name="studentId"
                          value={student.id}
                        />
                        <input
                          name="name"
                          required
                          defaultValue={student.name}
                          aria-label={`Name for ${student.name}`}
                          className={cellInputClass}
                        />
                        <input
                          name="nickname"
                          defaultValue={student.nickname ?? ""}
                          placeholder="—"
                          aria-label={`Nickname for ${student.name}`}
                          className={cellInputClass}
                        />
                        <input
                          name="notes"
                          defaultValue={student.notes ?? ""}
                          placeholder="—"
                          aria-label={`Notes for ${student.name}`}
                          className={cellInputClass}
                        />
                        <button
                          type="submit"
                          className="justify-self-start rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        >
                          Save
                        </button>
                      </form>
                      <form action={deleteStudentAction}>
                        <input type="hidden" name="periodId" value={period.id} />
                        <input
                          type="hidden"
                          name="studentId"
                          value={student.id}
                        />
                        <ConfirmSubmitButton
                          label="Remove"
                          confirmMessage={`Remove ${student.name} from this period?`}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        />
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form
                action={createStudentAction}
                className="grid grid-cols-[minmax(9rem,1.2fr)_minmax(6rem,0.7fr)_minmax(9rem,1.1fr)_auto] items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2"
              >
                <input type="hidden" name="periodId" value={period.id} />
                <input
                  name="name"
                  required
                  placeholder="Full name"
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
                <input
                  name="nickname"
                  placeholder="Nickname"
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
                <input
                  name="notes"
                  placeholder="Notes"
                  className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Add
                </button>
              </form>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Edit period</h2>
            <form action={updatePeriodAction} className="mt-4 space-y-4">
              <input type="hidden" name="periodId" value={period.id} />
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Name
                </span>
                <input
                  name="name"
                  required
                  defaultValue={period.name}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  School year (optional)
                </span>
                <input
                  name="schoolYear"
                  defaultValue={period.school_year ?? ""}
                  placeholder="2025-26"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Save period
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-red-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
            <p className="mt-2 text-sm text-slate-600">
              Deleting this period also removes its entire roster.
            </p>
            <form action={deletePeriodAction} className="mt-4">
              <input type="hidden" name="periodId" value={period.id} />
              <ConfirmSubmitButton
                label="Delete period"
                confirmMessage={`Delete "${period.name}" and all students in it? This cannot be undone.`}
                className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              />
            </form>
          </div>
        </aside>
      </div>
    </section>
  );
}

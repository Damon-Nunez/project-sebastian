import Link from "next/link";
import { createAssignmentAction } from "@/app/grading/assignmentActions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { gradingErrorMessage } from "@/lib/grading/errors";
import { listUnitsForTeacher } from "@/lib/units/units";

type NewAssignmentPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500";
const labelClass =
  "text-xs font-medium uppercase tracking-wide text-slate-500";

export default async function NewAssignmentPage({
  searchParams,
}: NewAssignmentPageProps) {
  const teacher = await getCurrentTeacher();
  const [units, { error }] = await Promise.all([
    listUnitsForTeacher(teacher.id),
    searchParams,
  ]);
  const errorMessage = gradingErrorMessage(error);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          <Link href="/grading" className="hover:text-slate-800">
            Grading
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          New assignment
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          New assignment
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          One assignment covers every period. Next you&apos;ll add the answer
          key (or an example) once, and every class&apos;s folder uses it.
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

      <form
        action={createAssignmentAction}
        className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <label className="block space-y-1.5">
          <span className={labelClass}>Name (optional)</span>
          <input
            name="title"
            placeholder="Mango Ch1"
            className={inputClass}
          />
        </label>
        <p className="text-xs text-slate-500">
          If you leave this blank, we use the M/U/L short name below (e.g.{" "}
          <span className="font-medium text-slate-700">M1U1L3-HW</span>).
        </p>
        <label className="block space-y-1.5">
          <span className={labelClass}>Type</span>
          <select name="assignmentType" defaultValue="hw" className={inputClass}>
            <option value="hw">HW</option>
            <option value="short_response">CW / short response</option>
            <option value="essay">Essay</option>
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1.5">
            <span className={labelClass}>Module</span>
            <input name="moduleLabel" placeholder="1" className={inputClass} />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Unit</span>
            <input name="unitLabel" placeholder="1" className={inputClass} />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Lesson</span>
            <input name="lessonLabel" placeholder="3" className={inputClass} />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Fill at least one — this keeps the assignment unique across periods
          even when you give it a custom name.
        </p>
        <label className="block space-y-1.5">
          <span className={labelClass}>Essay rubric unit (essays only)</span>
          <select name="unitId" defaultValue="" className={inputClass}>
            <option value="">—</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>
        <PendingSubmitButton
          idleLabel="Create assignment"
          pendingLabel="Creating…"
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        />
      </form>
    </section>
  );
}

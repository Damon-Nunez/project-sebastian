import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteUnitAction,
  updateUnitAction,
} from "@/app/units/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  isRubricCriteriaComplete,
  safeParseRubricCriteria,
} from "@/lib/rubrics/criteria";
import { listEssayRubricsForUnit } from "@/lib/rubrics/essay";
import { getUnitForTeacher } from "@/lib/units/units";

type UnitDetailPageProps = {
  params: Promise<{ unitId: string }>;
};

export default async function UnitDetailPage({
  params,
}: UnitDetailPageProps) {
  const { unitId } = await params;
  const teacher = await getCurrentTeacher();
  const unit = await getUnitForTeacher(teacher.id, unitId);

  if (!unit) {
    notFound();
  }

  const essayRubrics = await listEssayRubricsForUnit({
    teacherId: teacher.id,
    unitId: unit.id,
  });

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/units"
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← All units
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {unit.label}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sort order {unit.sort_order} · {essayRubrics.length} essay rubric
          {essayRubrics.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Essay rubrics
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Optional — only if this unit includes essay work. Shared across
                all periods.
              </p>
            </div>
            <Link
              href={`/units/${unit.id}/rubrics/new`}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add essay rubric
            </Link>
          </div>

          {essayRubrics.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No essay rubrics yet. Skip this if your subject doesn&apos;t use
              essays.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {essayRubrics.map((rubric) => {
                const parsed = safeParseRubricCriteria(rubric.criteria);
                const complete =
                  parsed.success === true &&
                  isRubricCriteriaComplete(parsed.data);
                return (
                  <li key={rubric.id}>
                    <Link
                      href={`/units/${unit.id}/rubrics/${rubric.id}`}
                      className="flex items-center justify-between gap-4 py-3 text-sm transition hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">
                        {rubric.name ?? "Untitled essay rubric"}
                      </span>
                      <span className="text-slate-500">
                        {complete ? "Ready" : "Draft"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Edit unit</h2>
            <form action={updateUnitAction} className="mt-4 space-y-4">
              <input type="hidden" name="unitId" value={unit.id} />
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Label
                </span>
                <input
                  name="label"
                  required
                  defaultValue={unit.label}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Sort order
                </span>
                <input
                  name="sortOrder"
                  type="number"
                  required
                  defaultValue={unit.sort_order}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Save unit
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-red-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
            <p className="mt-2 text-sm text-slate-600">
              You can&apos;t delete a unit that still has essay rubrics attached.
            </p>
            <form action={deleteUnitAction} className="mt-4">
              <input type="hidden" name="unitId" value={unit.id} />
              <ConfirmSubmitButton
                label="Delete unit"
                confirmMessage={`Delete "${unit.label}"? This cannot be undone.`}
                className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              />
            </form>
          </div>
        </aside>
      </div>
    </section>
  );
}

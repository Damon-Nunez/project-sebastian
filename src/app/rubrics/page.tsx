import Link from "next/link";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  getDailyWorkDefaults,
  pickDailyWorkEditorSource,
} from "@/lib/rubrics/defaults";
import {
  isRubricCriteriaComplete,
  safeParseRubricCriteria,
} from "@/lib/rubrics/criteria";
import { listEssayRubricsForUnit } from "@/lib/rubrics/essay";
import { listUnitsForTeacher } from "@/lib/units/units";

export default async function RubricsPage() {
  const teacher = await getCurrentTeacher();
  const [defaults, units] = await Promise.all([
    getDailyWorkDefaults(teacher.id),
    listUnitsForTeacher(teacher.id),
  ]);
  const source = pickDailyWorkEditorSource(defaults);
  const parsed = source
    ? safeParseRubricCriteria(source.criteria)
    : null;
  const complete =
    parsed?.success === true && isRubricCriteriaComplete(parsed.data);

  const essayLists = await Promise.all(
    units.map(async (unit) => ({
      unit,
      rubrics: await listEssayRubricsForUnit({
        teacherId: teacher.id,
        unitId: unit.id,
      }),
    })),
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Setup
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Rubrics
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Set up the scoring guides you reuse when grading. Homework uploads
          live under{" "}
          <Link
            href="/grading"
            className="font-medium text-slate-800 underline-offset-2 hover:underline"
          >
            Grading
          </Link>
          , organized by class and folders like M1U1L1-HW.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Daily work (homework + short response)
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              One rubric powers both homework and short-response for now.
              Multiple-choice doesn&apos;t need a rubric.
            </p>
            {source ? (
              <p className="mt-2 text-sm text-slate-500">
                {source.name ?? "Untitled"} ·{" "}
                {complete ? "Ready" : "Draft (some descriptors empty)"}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Not set up yet</p>
            )}
          </div>
          <Link
            href="/rubrics/daily"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {source ? "Edit" : "Create"}
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Essay rubrics
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Tied to a unit. Optional if your subject doesn&apos;t use essays.
            </p>
          </div>
          <Link
            href="/units"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Manage units
          </Link>
        </div>

        {units.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Create a unit first, then add an essay rubric on that unit&apos;s
            page.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {essayLists.map(({ unit, rubrics }) => (
              <li key={unit.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {unit.label}
                  </p>
                  <Link
                    href={`/units/${unit.id}`}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    Open unit
                  </Link>
                </div>
                {rubrics.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-600">
                    No essay rubrics yet.{" "}
                    <Link
                      href={`/units/${unit.id}/rubrics/new`}
                      className="font-medium text-slate-800 underline"
                    >
                      Add essay rubric
                    </Link>
                  </p>
                ) : (
                  <ul className="mt-1 divide-y divide-slate-100">
                    {rubrics.map((rubric) => (
                      <li key={rubric.id}>
                        <Link
                          href={`/units/${unit.id}/rubrics/${rubric.id}`}
                          className="flex items-center justify-between gap-4 py-2 text-sm transition hover:bg-slate-50"
                        >
                          <span className="font-medium text-slate-900">
                            {rubric.name ?? "Untitled"}
                          </span>
                          <span className="text-slate-500">Edit</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

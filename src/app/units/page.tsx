import Link from "next/link";
import { createUnitAction } from "@/app/units/actions";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { listUnitsForTeacher } from "@/lib/units/units";

export default async function UnitsPage() {
  const teacher = await getCurrentTeacher();
  const units = await listUnitsForTeacher(teacher.id);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Setup
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Units
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Create curriculum units so essay rubrics have a place to live. Labels
          are yours (for example &quot;Unit 3&quot; or a unit title) — shared
          across all periods.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Your units</h2>
          {units.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No units yet. Add one on the right — you can attach essay rubrics
              later.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {units.map((unit) => (
                <li key={unit.id}>
                  <Link
                    href={`/units/${unit.id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm transition hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">
                      {unit.label}
                    </span>
                    <span className="text-slate-500">
                      Order {unit.sort_order}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Add unit</h2>
          <form action={createUnitAction} className="mt-4 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Label
              </span>
              <input
                name="label"
                required
                placeholder="Unit 3"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create unit
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

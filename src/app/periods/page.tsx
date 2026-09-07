import Link from "next/link";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { listPeriodsForTeacher } from "@/lib/roster/periods";
import { createPeriodAction } from "@/app/periods/actions";

export default async function PeriodsPage() {
  const teacher = await getCurrentTeacher();
  const periods = await listPeriodsForTeacher(teacher.id);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Setup
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Periods
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Create a class period, then add students and optional notes. Each
          period has its own roster.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Your periods</h2>
          {periods.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No periods yet. Add one on the right to start a roster.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {periods.map((period) => (
                <li key={period.id}>
                  <Link
                    href={`/periods/${period.id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm transition hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">
                      {period.name}
                    </span>
                    <span className="text-slate-500">
                      {period.school_year ?? "No school year"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Add period</h2>
          <form action={createPeriodAction} className="mt-4 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Name
              </span>
              <input
                name="name"
                required
                placeholder="Period 1"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                School year (optional)
              </span>
              <input
                name="schoolYear"
                placeholder="2025-26"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create period
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

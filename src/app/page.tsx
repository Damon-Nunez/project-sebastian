import Link from "next/link";

export default function Home() {
  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Project Sebastian
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Teacher workload assistant
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          You are signed in. Open Lessons to upload a district framework and
          edit a pre-filled draft, or manage class periods and rosters.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/lessons"
            className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open lessons
          </Link>
          <Link
            href="/periods"
            className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Set up periods
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Ticket 4 status</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Create periods (name + optional school year)</li>
            <li>Roster: full student name + optional notes</li>
            <li>Teacher-scoped via signed-in profile</li>
            <li className="font-medium text-emerald-700">
              Ticket 5 in progress — upload a framework under Lessons
            </li>
          </ul>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Stack (locked)</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Vercel hosting</li>
            <li>Supabase Postgres + Auth</li>
            <li>Claude Sonnet via getAiClient</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

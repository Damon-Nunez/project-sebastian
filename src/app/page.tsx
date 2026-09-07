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
          You are signed in. Start by setting up class periods and student
          rosters — lesson planning and grading plug in next.
        </p>
        <Link
          href="/periods"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Set up periods
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Ticket 4 status</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Create periods (name + optional school year)</li>
            <li>Roster: full student name + optional notes</li>
            <li>Teacher-scoped via signed-in profile</li>
            <li className="font-medium text-amber-700">
              Next: Ticket 5 — district framework parsing
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

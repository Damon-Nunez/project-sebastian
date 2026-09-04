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
          You are signed in. Lesson planning and grading modules will plug into
          this desktop-first workspace as tickets land.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Ticket 1 status</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Google OAuth via Supabase Auth</li>
            <li>Cookie session clients</li>
            <li>Teacher allowlist (email + domain)</li>
            <li>teachers.auth_user_id sync on login</li>
            <li className="font-medium text-amber-700">
              Next: Ticket 2 — core database schema
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

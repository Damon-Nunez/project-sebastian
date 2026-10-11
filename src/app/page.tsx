import Link from "next/link";

const links = [
  {
    href: "/lessons",
    title: "Lessons",
    body: "Upload a framework and write the plan for class.",
  },
  {
    href: "/grading",
    title: "Grading",
    body: "File papers, review ranges, and copy comments out.",
  },
  {
    href: "/periods",
    title: "Periods",
    body: "Classes, rosters, and notes for each student.",
  },
];

export default function Home() {
  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Sebastian
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Home
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Lesson planning and grading for your classes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          >
            <h2 className="text-sm font-semibold text-slate-900">{link.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{link.body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

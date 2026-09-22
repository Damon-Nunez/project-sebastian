import Link from "next/link";
import { DailyRubricForm } from "@/components/DailyRubricForm";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  emptyRubricCriteria,
  safeParseRubricCriteria,
} from "@/lib/rubrics/criteria";
import {
  getDailyWorkDefaults,
  pickDailyWorkEditorSource,
} from "@/lib/rubrics/defaults";

export default async function DailyRubricPage() {
  const teacher = await getCurrentTeacher();
  const defaults = await getDailyWorkDefaults(teacher.id);
  const source = pickDailyWorkEditorSource(defaults);
  const parsed = source
    ? safeParseRubricCriteria(source.criteria)
    : null;

  const initialCriteria =
    parsed?.success === true
      ? parsed.data
      : emptyRubricCriteria({
          categoryNames: ["Category 1", "Category 2", "Category 3"],
        });
  const initialName = source?.name?.trim() || "Classwork / Homework";

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/rubrics"
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← All rubrics
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Daily work rubric
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Paste from your existing homework / classwork sheet. Saving updates
          both the homework and short-response defaults.
        </p>
      </div>

      <DailyRubricForm
        initialName={initialName}
        initialCriteria={initialCriteria}
      />
    </section>
  );
}

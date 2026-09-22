import Link from "next/link";
import { notFound } from "next/navigation";
import { resetPeriodDailyRubricAction } from "@/app/periods/rubricActions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { PeriodDailyRubricForm } from "@/components/PeriodDailyRubricForm";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  emptyRubricCriteria,
  safeParseRubricCriteria,
} from "@/lib/rubrics/criteria";
import {
  getSectionDailyOverrides,
  pickSectionDailyEditorSource,
  sectionHasDailyOverride,
} from "@/lib/rubrics/overrides";
import { getPeriodForTeacher } from "@/lib/roster/periods";

type PeriodDailyRubricPageProps = {
  params: Promise<{ periodId: string }>;
};

export default async function PeriodDailyRubricPage({
  params,
}: PeriodDailyRubricPageProps) {
  const { periodId } = await params;
  const teacher = await getCurrentTeacher();
  const period = await getPeriodForTeacher(teacher.id, periodId);

  if (!period) {
    notFound();
  }

  const overrides = await getSectionDailyOverrides({
    teacherId: teacher.id,
    sectionId: period.id,
  });

  if (!sectionHasDailyOverride(overrides)) {
    notFound();
  }

  const source = pickSectionDailyEditorSource(overrides);
  const parsed = source
    ? safeParseRubricCriteria(source.criteria)
    : null;
  const initialCriteria =
    parsed?.success === true
      ? parsed.data
      : emptyRubricCriteria({
          categoryNames: ["Category 1", "Category 2", "Category 3"],
        });

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href={`/periods/${period.id}`}
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← {period.name}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Period daily work rubric
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Override for {period.name} only. Reset below to go back to the shared
          default.
        </p>
      </div>

      <PeriodDailyRubricForm
        periodId={period.id}
        initialName={source?.name?.trim() || "Classwork / Homework"}
        initialCriteria={initialCriteria}
      />

      <div className="rounded-xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-red-800">Reset override</h2>
        <p className="mt-2 text-sm text-slate-600">
          Remove this period&apos;s copy and use the shared daily work rubric
          again.
        </p>
        <form action={resetPeriodDailyRubricAction} className="mt-4">
          <input type="hidden" name="periodId" value={period.id} />
          <ConfirmSubmitButton
            label="Use shared default again"
            confirmMessage={`Reset ${period.name} to the shared daily work rubric?`}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          />
        </form>
      </div>
    </section>
  );
}

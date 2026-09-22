import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEssayRubricAction } from "@/app/rubrics/essayActions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { EssayRubricForm } from "@/components/EssayRubricForm";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  emptyRubricCriteria,
  safeParseRubricCriteria,
} from "@/lib/rubrics/criteria";
import { getEssayRubricForTeacher } from "@/lib/rubrics/essay";
import { getUnitForTeacher } from "@/lib/units/units";

type EditEssayRubricPageProps = {
  params: Promise<{ unitId: string; rubricId: string }>;
};

export default async function EditEssayRubricPage({
  params,
}: EditEssayRubricPageProps) {
  const { unitId, rubricId } = await params;
  const teacher = await getCurrentTeacher();
  const [unit, rubric] = await Promise.all([
    getUnitForTeacher(teacher.id, unitId),
    getEssayRubricForTeacher({ teacherId: teacher.id, rubricId }),
  ]);

  if (!unit || !rubric || rubric.unit_id !== unit.id) {
    notFound();
  }

  const parsed = safeParseRubricCriteria(rubric.criteria);
  const initialCriteria =
    parsed.success === true
      ? parsed.data
      : emptyRubricCriteria({
          categoryNames: ["Category 1", "Category 2", "Category 3"],
        });

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href={`/units/${unit.id}`}
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← {unit.label}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {rubric.name ?? "Essay rubric"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Edit the essay rubric for {unit.label}. Changes apply across all
          periods.
        </p>
      </div>

      <EssayRubricForm
        unitId={unit.id}
        rubricId={rubric.id}
        initialName={rubric.name ?? ""}
        initialCriteria={initialCriteria}
      />

      <div className="rounded-xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-red-800">Danger zone</h2>
        <p className="mt-2 text-sm text-slate-600">
          Delete this essay rubric from {unit.label}. The unit itself stays.
        </p>
        <form action={deleteEssayRubricAction} className="mt-4">
          <input type="hidden" name="rubricId" value={rubric.id} />
          <ConfirmSubmitButton
            label="Delete essay rubric"
            confirmMessage={`Delete "${rubric.name ?? "this rubric"}"? This cannot be undone.`}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          />
        </form>
      </div>
    </section>
  );
}

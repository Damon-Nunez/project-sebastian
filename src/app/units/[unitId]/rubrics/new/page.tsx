import Link from "next/link";
import { notFound } from "next/navigation";
import { EssayRubricForm } from "@/components/EssayRubricForm";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { emptyRubricCriteria } from "@/lib/rubrics/criteria";
import { getUnitForTeacher } from "@/lib/units/units";

type NewEssayRubricPageProps = {
  params: Promise<{ unitId: string }>;
};

export default async function NewEssayRubricPage({
  params,
}: NewEssayRubricPageProps) {
  const { unitId } = await params;
  const teacher = await getCurrentTeacher();
  const unit = await getUnitForTeacher(teacher.id, unitId);

  if (!unit) {
    notFound();
  }

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
          New essay rubric
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Copy from your essay rubric sheet. This applies whenever you grade
          essays for {unit.label}.
        </p>
      </div>

      <EssayRubricForm
        unitId={unit.id}
        initialName=""
        initialCriteria={emptyRubricCriteria({
          categoryNames: ["Category 1", "Category 2", "Category 3"],
        })}
      />
    </section>
  );
}

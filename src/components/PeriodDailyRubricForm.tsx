"use client";

import { savePeriodDailyRubricAction } from "@/app/periods/rubricActions";
import { RubricEditorForm } from "@/components/RubricEditorForm";
import type { RubricCriteria } from "@/lib/rubrics/criteria";

type PeriodDailyRubricFormProps = {
  periodId: string;
  initialName: string;
  initialCriteria: RubricCriteria | null;
};

export function PeriodDailyRubricForm({
  periodId,
  initialName,
  initialCriteria,
}: PeriodDailyRubricFormProps) {
  return (
    <RubricEditorForm
      initialName={initialName}
      initialCriteria={initialCriteria}
      hiddenFields={{ periodId }}
      basicsHelp="This copy is only for this period. Other periods still use the shared daily work rubric."
      namePlaceholder="Classwork / Homework"
      submitLabel="Save period rubric"
      action={savePeriodDailyRubricAction}
    />
  );
}

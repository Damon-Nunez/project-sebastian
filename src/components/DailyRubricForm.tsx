"use client";

import { saveDailyWorkRubricAction } from "@/app/rubrics/actions";
import { RubricEditorForm } from "@/components/RubricEditorForm";
import type { RubricCriteria } from "@/lib/rubrics/criteria";

type DailyRubricFormProps = {
  initialName: string;
  initialCriteria: RubricCriteria | null;
};

export function DailyRubricForm({
  initialName,
  initialCriteria,
}: DailyRubricFormProps) {
  return (
    <RubricEditorForm
      initialName={initialName}
      initialCriteria={initialCriteria}
      basicsHelp="Saves as both homework and short-response defaults (same content for now)."
      namePlaceholder="Classwork / Homework"
      submitLabel="Save daily work rubric"
      action={saveDailyWorkRubricAction}
    />
  );
}

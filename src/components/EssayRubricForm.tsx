"use client";

import {
  createEssayRubricAction,
  updateEssayRubricAction,
} from "@/app/rubrics/essayActions";
import { RubricEditorForm } from "@/components/RubricEditorForm";
import type { RubricCriteria } from "@/lib/rubrics/criteria";

type EssayRubricFormProps = {
  unitId: string;
  rubricId?: string;
  initialName: string;
  initialCriteria: RubricCriteria | null;
};

export function EssayRubricForm({
  unitId,
  rubricId,
  initialName,
  initialCriteria,
}: EssayRubricFormProps) {
  const isEdit = Boolean(rubricId);

  return (
    <RubricEditorForm
      initialName={initialName}
      initialCriteria={initialCriteria}
      hiddenFields={{
        unitId,
        ...(rubricId ? { rubricId } : {}),
      }}
      basicsHelp="Name the essay type for this unit (for example Narrative or Persuasive). Shared across all periods."
      namePlaceholder="Narrative essay"
      submitLabel={isEdit ? "Save essay rubric" : "Create essay rubric"}
      action={isEdit ? updateEssayRubricAction : createEssayRubricAction}
    />
  );
}

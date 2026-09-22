"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString } from "@/lib/actionHelpers";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  deleteSectionDailyOverrides,
  ensureSectionDailyOverrides,
  updateSectionDailyOverrides,
} from "@/lib/rubrics/overrides";

function parseCriteriaJson(formData: FormData): unknown {
  const criteriaRaw = formString(formData, "criteriaJson");
  try {
    return JSON.parse(criteriaRaw);
  } catch {
    throw new Error("Invalid rubric criteria payload");
  }
}

/** Copy shared daily defaults into this period, then open the editor. */
export async function customizePeriodDailyRubricAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const periodId = formString(formData, "periodId");

  await ensureSectionDailyOverrides({
    teacherId: teacher.id,
    sectionId: periodId,
  });

  revalidatePath(`/periods/${periodId}`);
  redirect(`/periods/${periodId}/rubrics/daily`);
}

export async function savePeriodDailyRubricAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const periodId = formString(formData, "periodId");

  await updateSectionDailyOverrides({
    teacherId: teacher.id,
    sectionId: periodId,
    name: formString(formData, "name"),
    criteria: parseCriteriaJson(formData),
  });

  revalidatePath("/rubrics");
  revalidatePath(`/periods/${periodId}`);
  revalidatePath(`/periods/${periodId}/rubrics/daily`);
  redirect(`/periods/${periodId}`);
}

export async function resetPeriodDailyRubricAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const periodId = formString(formData, "periodId");

  await deleteSectionDailyOverrides({
    teacherId: teacher.id,
    sectionId: periodId,
  });

  revalidatePath("/rubrics");
  revalidatePath(`/periods/${periodId}`);
  revalidatePath(`/periods/${periodId}/rubrics/daily`);
  redirect(`/periods/${periodId}`);
}

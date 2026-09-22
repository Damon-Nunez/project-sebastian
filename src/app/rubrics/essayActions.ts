"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString } from "@/lib/actionHelpers";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  createEssayRubric,
  deleteEssayRubric,
  updateEssayRubric,
} from "@/lib/rubrics/essay";

function parseCriteriaJson(formData: FormData): unknown {
  const criteriaRaw = formString(formData, "criteriaJson");
  try {
    return JSON.parse(criteriaRaw);
  } catch {
    throw new Error("Invalid rubric criteria payload");
  }
}

export async function createEssayRubricAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const unitId = formString(formData, "unitId");
  await createEssayRubric({
    teacherId: teacher.id,
    unitId,
    name: formString(formData, "name"),
    criteria: parseCriteriaJson(formData),
  });

  revalidatePath("/rubrics");
  revalidatePath("/units");
  revalidatePath(`/units/${unitId}`);
  redirect(`/units/${unitId}`);
}

export async function updateEssayRubricAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const unitId = formString(formData, "unitId");
  const rubricId = formString(formData, "rubricId");

  await updateEssayRubric({
    teacherId: teacher.id,
    rubricId,
    name: formString(formData, "name"),
    criteria: parseCriteriaJson(formData),
  });

  revalidatePath("/rubrics");
  revalidatePath("/units");
  revalidatePath(`/units/${unitId}`);
  revalidatePath(`/units/${unitId}/rubrics/${rubricId}`);
  redirect(`/units/${unitId}`);
}

export async function deleteEssayRubricAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const rubricId = formString(formData, "rubricId");

  const { unitId } = await deleteEssayRubric({
    teacherId: teacher.id,
    rubricId,
  });

  revalidatePath("/rubrics");
  revalidatePath("/units");
  revalidatePath(`/units/${unitId}`);
  redirect(`/units/${unitId}`);
}

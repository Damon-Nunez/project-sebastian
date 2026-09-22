"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString } from "@/lib/actionHelpers";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { upsertDailyWorkDefaults } from "@/lib/rubrics/defaults";

export async function saveDailyWorkRubricAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const name = formString(formData, "name");
  const criteriaRaw = formString(formData, "criteriaJson");

  let criteria: unknown;
  try {
    criteria = JSON.parse(criteriaRaw);
  } catch {
    throw new Error("Invalid rubric criteria payload");
  }

  await upsertDailyWorkDefaults({
    teacherId: teacher.id,
    name,
    criteria,
  });

  revalidatePath("/rubrics");
  revalidatePath("/rubrics/daily");
  redirect("/rubrics");
}

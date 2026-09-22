"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString } from "@/lib/actionHelpers";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  createUnit,
  deleteUnit,
  updateUnit,
} from "@/lib/units/units";

export async function createUnitAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const unit = await createUnit({
    teacherId: teacher.id,
    label: formString(formData, "label"),
  });

  revalidatePath("/units");
  revalidatePath("/rubrics");
  redirect(`/units/${unit.id}`);
}

export async function updateUnitAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const unitId = formString(formData, "unitId");
  const sortRaw = formString(formData, "sortOrder");
  const sortOrder = Number.parseInt(sortRaw, 10);

  await updateUnit({
    teacherId: teacher.id,
    unitId,
    label: formString(formData, "label"),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
  });

  revalidatePath("/units");
  revalidatePath(`/units/${unitId}`);
  revalidatePath("/rubrics");
}

export async function deleteUnitAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const unitId = formString(formData, "unitId");

  await deleteUnit({
    teacherId: teacher.id,
    unitId,
  });

  revalidatePath("/units");
  revalidatePath("/rubrics");
  redirect("/units");
}

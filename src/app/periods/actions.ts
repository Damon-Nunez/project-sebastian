"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  createPeriod,
  deletePeriod,
  getPeriodForTeacher,
  updatePeriod,
} from "@/lib/roster/periods";
import {
  createStudent,
  deleteStudent,
  updateStudent,
} from "@/lib/roster/students";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createPeriodAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const period = await createPeriod({
    teacherId: teacher.id,
    name: formString(formData, "name"),
    schoolYear: formString(formData, "schoolYear"),
  });

  revalidatePath("/periods");
  redirect(`/periods/${period.id}`);
}

export async function updatePeriodAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const periodId = formString(formData, "periodId");

  await updatePeriod({
    teacherId: teacher.id,
    periodId,
    name: formString(formData, "name"),
    schoolYear: formString(formData, "schoolYear"),
  });

  revalidatePath("/periods");
  revalidatePath(`/periods/${periodId}`);
}

export async function deletePeriodAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const periodId = formString(formData, "periodId");

  await deletePeriod({
    teacherId: teacher.id,
    periodId,
  });

  revalidatePath("/periods");
  redirect("/periods");
}

export async function createStudentAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const periodId = formString(formData, "periodId");

  const owned = await getPeriodForTeacher(teacher.id, periodId);
  if (!owned) {
    throw new Error("Period not found");
  }

  await createStudent({
    teacherId: teacher.id,
    periodId,
    name: formString(formData, "name"),
    nickname: formString(formData, "nickname"),
    notes: formString(formData, "notes"),
  });

  revalidatePath(`/periods/${periodId}`);
}

export async function updateStudentAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const periodId = formString(formData, "periodId");
  const studentId = formString(formData, "studentId");

  await updateStudent({
    teacherId: teacher.id,
    periodId,
    studentId,
    name: formString(formData, "name"),
    nickname: formString(formData, "nickname"),
    notes: formString(formData, "notes"),
  });

  revalidatePath(`/periods/${periodId}`);
}

export async function deleteStudentAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const periodId = formString(formData, "periodId");
  const studentId = formString(formData, "studentId");

  await deleteStudent({
    teacherId: teacher.id,
    periodId,
    studentId,
  });

  revalidatePath(`/periods/${periodId}`);
}

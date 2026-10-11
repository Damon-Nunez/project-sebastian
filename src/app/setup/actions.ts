"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { isCoreSubject, isGradeBand, isHonorific } from "@/lib/auth/teacherHeader";
import { formString } from "@/lib/actionHelpers";
import { normalizeRequiredName } from "@/lib/roster/validate";
import {
  loadSetupProgress,
  markSetupFinished,
  saveWelcomeProfile,
} from "@/lib/setup/loadSetupProgress";

export async function saveWelcomeAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const displayName = normalizeRequiredName(formString(formData, "displayName"));
  const subject = formString(formData, "subject").trim();
  const gradeLabel = formString(formData, "gradeLabel").trim();
  const honorific = formString(formData, "honorific").trim();

  if (
    !displayName ||
    !isCoreSubject(subject) ||
    !isGradeBand(gradeLabel) ||
    !isHonorific(honorific)
  ) {
    redirect("/setup?error=welcome");
  }

  await saveWelcomeProfile({
    teacherId: teacher.id,
    displayName,
    honorific,
    subject,
    gradeLabel,
  });

  revalidatePath("/setup");
  redirect("/setup");
}

export async function finishSetupAction() {
  const teacher = await getCurrentTeacher();
  const progress = await loadSetupProgress(teacher);
  if (!progress.minimumMet) {
    redirect("/setup?error=incomplete");
  }

  await markSetupFinished(teacher.id);
  revalidatePath("/");
  redirect("/");
}

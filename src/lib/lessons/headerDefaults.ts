import {
  DEFAULT_LESSON_TIME_FRAME,
  teacherHeaderDefaults,
  type TeacherHeaderProfile,
} from "@/lib/auth/teacherHeader";
import type { LessonPlanContent } from "./content";

/**
 * Fill empty district-header fields from teacher profile (+ optional parse text).
 *
 * Profile-sourced fields (subject / grade / teacher / timeFrame) are filled only
 * when *all* of them are empty — so a teacher can clear one field and save without
 * it being restored on the next page load. textTitle still merges from parse when empty.
 */
export function withHeaderDefaults(
  content: LessonPlanContent,
  profile: TeacherHeaderProfile,
  options: { textTitle?: string | null } = {},
): LessonPlanContent {
  const defaults = teacherHeaderDefaults(profile);
  const parsedText = (options.textTitle ?? "").trim();
  const profileFieldsEmpty =
    !content.subject.trim() &&
    !content.gradeLabel.trim() &&
    !content.teacherLine.trim() &&
    !content.timeFrame.trim();

  return {
    ...content,
    subject: profileFieldsEmpty ? defaults.subject : content.subject,
    gradeLabel: profileFieldsEmpty ? defaults.gradeLabel : content.gradeLabel,
    teacherLine: profileFieldsEmpty ? defaults.teacherLine : content.teacherLine,
    timeFrame: profileFieldsEmpty
      ? defaults.timeFrame || DEFAULT_LESSON_TIME_FRAME
      : content.timeFrame,
    textTitle: content.textTitle.trim() || parsedText,
  };
}

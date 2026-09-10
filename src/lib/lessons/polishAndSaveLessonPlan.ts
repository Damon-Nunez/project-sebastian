import type { LessonPlanContent } from "./content";
import { parseLessonPlanContent } from "./content";
import {
  getLessonPlanForTeacher,
  updateLessonPlanContent,
} from "./plans";
import { parseSectionGroups, type SectionGroupsMap } from "./sectionGroups";
import { polishLessonPlanWithLlm } from "./polishLessonPlanLlm";
import { listStudentsForTeacher } from "@/lib/roster/students";
import type { RosterStudent } from "@/lib/sanitizer/types";

export type PolishLessonPlanResult = {
  content: LessonPlanContent;
  model: string;
};

function toRosterStudents(
  rows: { id: string; name: string; nickname?: string | null }[],
): RosterStudent[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    nickname: row.nickname ?? null,
  }));
}

/**
 * Load draft + teacher roster, run sanitized polish middleman, persist Edited bodies.
 * Does not flip status to final (that is Local Save / FINISHED — Trax 2.3).
 */
export async function polishAndSaveLessonPlan(input: {
  teacherId: string;
  lessonPlanId: string;
  /** When provided (editor submit), polish this snapshot instead of DB-only content. */
  content?: LessonPlanContent;
  freeTextAsks?: string | null;
  moduleLabel?: string | null;
  unitLabel?: string | null;
  lessonLabel?: string | null;
  sectionGroups?: SectionGroupsMap | null;
}): Promise<PolishLessonPlanResult> {
  const plan = await getLessonPlanForTeacher(
    input.teacherId,
    input.lessonPlanId,
  );
  if (!plan) {
    throw new Error("Lesson plan not found");
  }

  const content =
    input.content ?? parseLessonPlanContent(plan.content);
  const sectionGroups =
    input.sectionGroups !== undefined && input.sectionGroups !== null
      ? input.sectionGroups
      : parseSectionGroups(plan.section_groups);
  const freeTextAsks =
    input.freeTextAsks !== undefined
      ? input.freeTextAsks
      : plan.free_text_asks;
  const moduleLabel =
    input.moduleLabel !== undefined ? input.moduleLabel : plan.module_label;
  const unitLabel =
    input.unitLabel !== undefined ? input.unitLabel : plan.unit_label;
  const lessonLabel =
    input.lessonLabel !== undefined ? input.lessonLabel : plan.lesson_label;

  const students = await listStudentsForTeacher(input.teacherId);
  const roster = toRosterStudents(students);

  const polished = await polishLessonPlanWithLlm({
    content,
    teacherId: input.teacherId,
    roster,
    freeTextAsks,
    sectionGroups,
    moduleLabel,
    unitLabel,
    lessonLabel,
  });

  await updateLessonPlanContent({
    teacherId: input.teacherId,
    lessonPlanId: input.lessonPlanId,
    content: polished.content,
    freeTextAsks,
    moduleLabel,
    unitLabel,
    lessonLabel,
    sectionGroups,
  });

  return {
    content: polished.content,
    model: polished.model,
  };
}

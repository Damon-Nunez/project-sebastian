import { z } from "zod";

/**
 * Ticket 5 / Approach A: fixed formula fields + flexible Work Time array.
 * Lives in lesson_plans.content (jsonb). Row columns keep M/U/L labels,
 * free_text_asks, and section_groups.
 */

const labeledBlockSchema = z.object({
  label: z.string(),
  body: z.string(),
});

const workTimeBlockSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  body: z.string(),
});

/** YYYY-MM-DD or null (unset). */
const lessonDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "lessonDate must be YYYY-MM-DD")
  .nullable();

export const lessonPlanContentSchema = z.object({
  version: z.literal(1),
  lessonDate: lessonDateSchema,
  standards: z.string(),
  agenda: z.string(),
  materials: z.string(),
  opening: labeledBlockSchema,
  workTimes: z.array(workTimeBlockSchema),
  closing: labeledBlockSchema,
  /** Parsed sections that did not map to a known field. */
  extras: z.array(labeledBlockSchema),
});

export type LabeledBlock = z.infer<typeof labeledBlockSchema>;
export type WorkTimeBlock = z.infer<typeof workTimeBlockSchema>;
export type LessonPlanContent = z.infer<typeof lessonPlanContentSchema>;

const WORK_TIME_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function workTimeKeyForIndex(index: number): string {
  if (index < 0 || index >= WORK_TIME_KEYS.length) {
    throw new Error(`Work Time index out of range: ${index}`);
  }
  return WORK_TIME_KEYS[index]!;
}

export function emptyWorkTimeBlock(index: number): WorkTimeBlock {
  const key = workTimeKeyForIndex(index);
  return {
    key,
    label: `Work Time ${key}`,
    body: "",
  };
}

/** Blank plan body ready for parse pre-fill or teacher edit. */
export function emptyLessonPlanContent(
  options: { workTimeCount?: number } = {},
): LessonPlanContent {
  const workTimeCount = options.workTimeCount ?? 2;
  if (workTimeCount < 0 || workTimeCount > WORK_TIME_KEYS.length) {
    throw new Error(`workTimeCount out of range: ${workTimeCount}`);
  }

  return {
    version: 1,
    lessonDate: null,
    standards: "",
    agenda: "",
    materials: "",
    opening: { label: "Opening", body: "" },
    workTimes: Array.from({ length: workTimeCount }, (_, i) =>
      emptyWorkTimeBlock(i),
    ),
    closing: { label: "Closing", body: "" },
    extras: [],
  };
}

export function parseLessonPlanContent(raw: unknown): LessonPlanContent {
  return lessonPlanContentSchema.parse(raw);
}

export function safeParseLessonPlanContent(raw: unknown) {
  return lessonPlanContentSchema.safeParse(raw);
}

const DEFAULT_WORK_TIME_LABEL = /^Work Time [A-Z]$/i;

/**
 * Grow/shrink Work Time blocks. Keeps earlier bodies when reducing count;
 * adds empty blocks when growing. Re-keys to A, B, C…
 */
export function resizeWorkTimes(
  content: LessonPlanContent,
  count: number,
): LessonPlanContent {
  if (count < 1 || count > WORK_TIME_KEYS.length) {
    throw new Error(`workTimeCount out of range: ${count}`);
  }

  const next = content.workTimes.slice(0, count);
  while (next.length < count) {
    next.push(emptyWorkTimeBlock(next.length));
  }

  return {
    ...content,
    workTimes: next.map((block, index) => {
      const key = workTimeKeyForIndex(index);
      const label =
        !block.label || DEFAULT_WORK_TIME_LABEL.test(block.label)
          ? `Work Time ${key}`
          : block.label;
      return { ...block, key, label };
    }),
  };
}

import { z } from "zod";
import {
  emptyLessonPlanContent,
  emptyWorkTimeBlock,
  type LessonPlanContent,
  workTimeKeyForIndex,
} from "./content";

/**
 * Schema-constrained buckets for LLM framework sorting.
 * Revised formula constants (Issue 1) — extract only, do not invent.
 */
export const frameworkLlmBucketsSchema = z.object({
  module_label: z.string().nullable(),
  unit_label: z.string().nullable(),
  lesson_label: z.string().nullable(),
  /** Lesson learning targets only (I can…). */
  learningTargets: z.string(),
  /** Short timed outline only — not Teaching Notes / Homework bodies. */
  agenda: z.string(),
  opening: z.object({
    label: z.string(),
    body: z.string(),
  }),
  closing: z.object({
    label: z.string(),
    body: z.string(),
  }),
  /** Homework assignments — never folded into agenda. */
  homework: z.string(),
  materials: z.string(),
  /** Standard codes only, e.g. "8R6", "RL.8.1" — not prose. */
  standardsCodes: z.array(z.string()),
  /** Suggestion for the teacher; bodies stay empty for teacher ownership. */
  suggestedWorkTimeCount: z.number().int().min(0).max(8),
  /** Optional short titles for Work Time A/B/… (no instructional bodies). */
  workTimeTitles: z.array(z.string()),
});

export type FrameworkLlmBuckets = z.infer<typeof frameworkLlmBucketsSchema>;

export const FRAMEWORK_LLM_JSON_SHAPE = `{
  "module_label": string | null,
  "unit_label": string | null,
  "lesson_label": string | null,
  "learningTargets": string,
  "agenda": string,
  "opening": { "label": string, "body": string },
  "closing": { "label": string, "body": string },
  "homework": string,
  "materials": string,
  "standardsCodes": string[],
  "suggestedWorkTimeCount": number,
  "workTimeTitles": string[]
}`;

/**
 * Map LLM buckets into today's LessonPlanContent shape for the form populater.
 * Learning Targets + Homework land in extras until content schema is revised.
 * Work Time bodies stay empty; count/titles are suggestions only.
 */
export function bucketsToLessonPlanContent(
  buckets: FrameworkLlmBuckets,
): LessonPlanContent {
  const count = Math.max(0, buckets.suggestedWorkTimeCount);
  const base = emptyLessonPlanContent({ workTimeCount: 0 });

  const workTimes =
    count === 0
      ? []
      : Array.from({ length: count }, (_, i) => {
          const block = emptyWorkTimeBlock(i);
          const title = buckets.workTimeTitles[i]?.trim();
          return {
            ...block,
            label: title
              ? `Work Time ${workTimeKeyForIndex(i)}: ${title}`
              : block.label,
            body: "",
          };
        });

  const extras: LessonPlanContent["extras"] = [];
  if (buckets.learningTargets.trim()) {
    extras.push({
      label: "Learning Targets",
      body: buckets.learningTargets.trim(),
    });
  }
  if (buckets.homework.trim()) {
    extras.push({ label: "Homework", body: buckets.homework.trim() });
  }

  return {
    ...base,
    standards: buckets.standardsCodes.map((c) => c.trim()).filter(Boolean).join(", "),
    agenda: buckets.agenda.trim(),
    materials: buckets.materials.trim(),
    opening: {
      label: buckets.opening.label.trim() || "Opening",
      body: buckets.opening.body.trim(),
    },
    closing: {
      label: buckets.closing.label.trim() || "Closing",
      body: buckets.closing.body.trim(),
    },
    workTimes,
    extras,
  };
}

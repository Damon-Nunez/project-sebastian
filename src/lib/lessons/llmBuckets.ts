import { z } from "zod";
import {
  emptyLessonPlanContent,
  emptyWorkTimeBlock,
  type LessonPlanContent,
  workTimeKeyForIndex,
} from "./content";

/**
 * Schema-constrained buckets for LLM framework sorting.
 * Revised formula constants — extract only, do not invent.
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
    minutes: z.number().int().min(0).nullable(),
  }),
  closing: z.object({
    label: z.string(),
    body: z.string(),
    minutes: z.number().int().min(0).nullable(),
  }),
  /**
   * Student-facing entrance ticket prompt/question(s) from the framework.
   * Include the question text; skip long answer keys when possible.
   */
  entranceTicket: z.string(),
  /**
   * Vocabulary as one item per line (word — gloss). Prefer bullets; we normalize.
   */
  vocabulary: z.string(),
  /** Homework assignments — never folded into agenda. */
  homework: z.string(),
  materials: z.string(),
  /** Standard codes only, e.g. "8R6", "RL.8.1" — not prose. */
  standardsCodes: z.array(z.string()),
  /**
   * Work Time blocks from the framework — include instructional body text.
   * Teacher may still edit after pre-fill.
   */
  workTimes: z.array(
    z.object({
      title: z.string(),
      minutes: z.number().int().min(0).nullable(),
      body: z.string(),
    }),
  ),
});

export type FrameworkLlmBuckets = z.infer<typeof frameworkLlmBucketsSchema>;

export const FRAMEWORK_LLM_JSON_SHAPE = `{
  "module_label": string | null,
  "unit_label": string | null,
  "lesson_label": string | null,
  "learningTargets": string,
  "agenda": string,
  "opening": { "label": string, "body": string, "minutes": number | null },
  "closing": { "label": string, "body": string, "minutes": number | null },
  "entranceTicket": string,
  "vocabulary": string,
  "homework": string,
  "materials": string,
  "standardsCodes": string[],
  "workTimes": [ { "title": string, "minutes": number | null, "body": string } ]
}`;

/** Turn vocabulary into clean bullet lines (one term per line). */
export function formatVocabularyBullets(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const roughLines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items =
    roughLines.length <= 1 && /[,;]/.test(trimmed)
      ? trimmed
          .split(/[,;]/)
          .map((part) => part.trim())
          .filter(Boolean)
      : roughLines;

  return items
    .map((item) => item.replace(/^[•\-\*◦●]\s*/, "").trim())
    .filter(Boolean)
    .map((item) => `• ${item}`)
    .join("\n");
}

/**
 * Map LLM buckets into LessonPlanContent for the form populater.
 * Learning Targets + Homework land in extras until first-class schema fields.
 * Work Time bodies are pre-filled from the framework and remain editable.
 */
export function bucketsToLessonPlanContent(
  buckets: FrameworkLlmBuckets,
): LessonPlanContent {
  const base = emptyLessonPlanContent({ workTimeCount: 0 });

  const workTimes =
    buckets.workTimes.length === 0
      ? []
      : buckets.workTimes.map((wt, i) => {
          const block = emptyWorkTimeBlock(i);
          const title = wt.title.trim();
          return {
            ...block,
            label: title
              ? `Work Time ${workTimeKeyForIndex(i)}: ${title}`
              : block.label,
            minutes: wt.minutes,
            body: wt.body.trim(),
          };
        });

  const extras: LessonPlanContent["extras"] = [];
  if (buckets.learningTargets.trim()) {
    extras.push({
      label: "Learning Targets",
      body: buckets.learningTargets.trim(),
      minutes: null,
    });
  }
  if (buckets.homework.trim()) {
    extras.push({
      label: "Homework",
      body: buckets.homework.trim(),
      minutes: null,
    });
  }

  return {
    ...base,
    standards: buckets.standardsCodes
      .map((c) => c.trim())
      .filter(Boolean)
      .join(", "),
    agenda: buckets.agenda.trim(),
    vocabulary: formatVocabularyBullets(buckets.vocabulary),
    entranceTicket: buckets.entranceTicket.trim(),
    materials: buckets.materials.trim(),
    opening: {
      label: buckets.opening.label.trim() || "Opening",
      body: buckets.opening.body.trim(),
      minutes: buckets.opening.minutes,
    },
    closing: {
      label: buckets.closing.label.trim() || "Closing",
      body: buckets.closing.body.trim(),
      minutes: buckets.closing.minutes,
    },
    workTimes,
    extras,
  };
}

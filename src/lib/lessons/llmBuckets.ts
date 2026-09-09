import { z } from "zod";
import {
  emptyLessonPlanContent,
  emptyWorkTimeBlock,
  withBodyVariants,
  type LessonPlanContent,
  workTimeKeyForIndex,
} from "./content";

/**
 * Schema-constrained buckets for LLM framework sorting.
 * Revised formula constants — extract only, do not invent.
 * Opening / Closing / Work Times include full body + simplified sibling.
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
    /** Condensed teacher-facing version (core moves + questions to ask). */
    bodySimplified: z.string().default(""),
    minutes: z.number().int().min(0).nullable(),
  }),
  closing: z.object({
    label: z.string(),
    body: z.string(),
    bodySimplified: z.string().default(""),
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
      bodySimplified: z.string().default(""),
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
  "opening": { "label": string, "body": string, "bodySimplified": string, "minutes": number | null },
  "closing": { "label": string, "body": string, "bodySimplified": string, "minutes": number | null },
  "entranceTicket": string,
  "vocabulary": string,
  "homework": string,
  "materials": string,
  "standardsCodes": string[],
  "workTimes": [ { "title": string, "minutes": number | null, "body": string, "bodySimplified": string } ]
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
 * Edited body starts as a copy of Original; Simplified is its own sibling.
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
          const variants = withBodyVariants(wt.body, wt.bodySimplified);
          return {
            ...block,
            label: title
              ? `Work Time ${workTimeKeyForIndex(i)}: ${title}`
              : block.label,
            minutes: wt.minutes,
            ...variants,
          };
        });

  const extras: LessonPlanContent["extras"] = [];
  if (buckets.learningTargets.trim()) {
    extras.push({
      label: "Learning Targets",
      ...withBodyVariants(buckets.learningTargets),
      minutes: null,
    });
  }
  if (buckets.homework.trim()) {
    extras.push({
      label: "Homework",
      ...withBodyVariants(buckets.homework),
      minutes: null,
    });
  }

  const openingVariants = withBodyVariants(
    buckets.opening.body,
    buckets.opening.bodySimplified,
  );
  const closingVariants = withBodyVariants(
    buckets.closing.body,
    buckets.closing.bodySimplified,
  );

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
      minutes: buckets.opening.minutes,
      ...openingVariants,
    },
    closing: {
      label: buckets.closing.label.trim() || "Closing",
      minutes: buckets.closing.minutes,
      ...closingVariants,
    },
    workTimes,
    workTimesReservoir: [],
    extras,
  };
}

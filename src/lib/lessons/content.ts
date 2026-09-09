import { z } from "zod";

/**
 * Ticket 5 / Approach A: fixed formula fields + flexible Work Time array.
 * Lives in lesson_plans.content (jsonb). Row columns keep M/U/L labels,
 * free_text_asks, and section_groups.
 *
 * Opening / Closing / Work Time bodies keep three variants:
 * - body = Edited (teacher working copy; what generation uses)
 * - bodyOriginal = full parser rip (read-only in UI)
 * - bodySimplified = condensed teacher-facing version (read-only in UI)
 */

/** Simplify sections at or above this length (chars). Shorter ones keep simplified === original. */
export const SIMPLIFY_CHAR_THRESHOLD = 600;

export type BodyViewMode = "edited" | "simplified" | "original";

const minutesSchema = z.number().int().min(0).nullable().default(null);

const labeledBlockSchema = z.object({
  label: z.string(),
  /** Edited working copy (generation input). */
  body: z.string(),
  /** Full parser extract. */
  bodyOriginal: z.string().default(""),
  /** Condensed teacher-facing version. */
  bodySimplified: z.string().default(""),
  /** Agenda timing when known (Opening / Closing). */
  minutes: minutesSchema,
});

const workTimeBlockSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  /** Minutes allotted for this block when known from the framework. */
  minutes: minutesSchema,
  body: z.string(),
  bodyOriginal: z.string().default(""),
  bodySimplified: z.string().default(""),
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
  /** Academic / domain vocabulary list from the framework. */
  vocabulary: z.string().default(""),
  /**
   * Student-facing entrance ticket prompt/questions from the framework.
   * Distinct from Opening body (teacher routine / interpretation).
   */
  entranceTicket: z.string().default(""),
  materials: z.string(),
  opening: labeledBlockSchema,
  workTimes: z.array(workTimeBlockSchema),
  /**
   * Work Time blocks removed when the teacher lowers block count.
   * Restored (FIFO from the front) when count grows again so B/C aren’t lost.
   */
  workTimesReservoir: z.array(workTimeBlockSchema).default([]),
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

/** Build body / bodyOriginal / bodySimplified from parser output. */
export function withBodyVariants(
  original: string,
  simplified?: string,
): Pick<LabeledBlock, "body" | "bodyOriginal" | "bodySimplified"> {
  const o = original.trim();
  const s = (simplified ?? "").trim();

  if (!o) {
    return { body: "", bodyOriginal: "", bodySimplified: "" };
  }

  // Short enough — no real simplify pass needed; keep all three aligned.
  if (o.length < SIMPLIFY_CHAR_THRESHOLD) {
    return { body: o, bodyOriginal: o, bodySimplified: o };
  }

  return {
    body: o,
    bodyOriginal: o,
    bodySimplified: s || o,
  };
}

export function resolveOriginalBody(block: {
  body: string;
  bodyOriginal?: string;
}): string {
  const original = block.bodyOriginal?.trim();
  if (original) return block.bodyOriginal!;
  return block.body;
}

export function resolveSimplifiedBody(block: {
  body: string;
  bodyOriginal?: string;
  bodySimplified?: string;
}): string {
  const simplified = block.bodySimplified?.trim();
  if (simplified) return block.bodySimplified!;
  return resolveOriginalBody(block);
}

export function bodyForViewMode(
  block: {
    body: string;
    bodyOriginal?: string;
    bodySimplified?: string;
  },
  mode: BodyViewMode,
): string {
  if (mode === "edited") return block.body;
  if (mode === "simplified") return resolveSimplifiedBody(block);
  return resolveOriginalBody(block);
}

export function emptyWorkTimeBlock(index: number): WorkTimeBlock {
  const key = workTimeKeyForIndex(index);
  return {
    key,
    label: `Work Time ${key}`,
    minutes: null,
    body: "",
    bodyOriginal: "",
    bodySimplified: "",
  };
}

export function emptyLabeledBlock(label: string): LabeledBlock {
  return {
    label,
    body: "",
    bodyOriginal: "",
    bodySimplified: "",
    minutes: null,
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
    vocabulary: "",
    entranceTicket: "",
    materials: "",
    opening: emptyLabeledBlock("Opening"),
    workTimes: Array.from({ length: workTimeCount }, (_, i) =>
      emptyWorkTimeBlock(i),
    ),
    workTimesReservoir: [],
    closing: emptyLabeledBlock("Closing"),
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

function rekeyWorkTimeBlock(block: WorkTimeBlock, index: number): WorkTimeBlock {
  const key = workTimeKeyForIndex(index);
  const label =
    !block.label || DEFAULT_WORK_TIME_LABEL.test(block.label)
      ? `Work Time ${key}`
      : block.label;
  return {
    ...block,
    key,
    label,
    minutes: block.minutes ?? null,
    bodyOriginal: block.bodyOriginal ?? "",
    bodySimplified: block.bodySimplified ?? "",
  };
}

/**
 * Grow/shrink Work Time blocks.
 * Shrinking parks removed blocks in workTimesReservoir (keeps Original/Simplified/Edited).
 * Growing restores from the reservoir before creating empty blocks. Re-keys to A, B, C…
 */
export function resizeWorkTimes(
  content: LessonPlanContent,
  count: number,
): LessonPlanContent {
  if (count < 1 || count > WORK_TIME_KEYS.length) {
    throw new Error(`workTimeCount out of range: ${count}`);
  }

  const reservoir = [...(content.workTimesReservoir ?? [])];
  let active = [...content.workTimes];

  if (count < active.length) {
    const removed = active.slice(count);
    active = active.slice(0, count);
    reservoir.unshift(...removed);
  } else if (count > active.length) {
    while (active.length < count && reservoir.length > 0) {
      active.push(reservoir.shift()!);
    }
    while (active.length < count) {
      active.push(emptyWorkTimeBlock(active.length));
    }
  }

  return {
    ...content,
    workTimes: active.map((block, index) => rekeyWorkTimeBlock(block, index)),
    workTimesReservoir: reservoir.map((block, index) => ({
      ...block,
      // Keep reservoir keys stable-ish for debugging; UI doesn’t show these.
      key: block.key || workTimeKeyForIndex(index),
      bodyOriginal: block.bodyOriginal ?? "",
      bodySimplified: block.bodySimplified ?? "",
    })),
  };
}

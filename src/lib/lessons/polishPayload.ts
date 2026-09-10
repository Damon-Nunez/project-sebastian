import { z } from "zod";
import type { LessonPlanContent } from "./content";
import type { SectionGroupsMap } from "./sectionGroups";

/**
 * Editable text fields sent to / returned from the finalize polish LLM.
 * Intentionally omits images, links, bodyOriginal, bodySimplified, and ids
 * that must stay under teacher/local control.
 */
export const polishFieldsSchema = z.object({
  standards: z.string(),
  agenda: z.string(),
  vocabulary: z.string(),
  entranceTicket: z.string(),
  materials: z.string(),
  opening: z.object({
    body: z.string(),
    minutes: z.number().int().min(0).nullable(),
  }),
  closing: z.object({
    body: z.string(),
    minutes: z.number().int().min(0).nullable(),
  }),
  workTimes: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string(),
      minutes: z.number().int().min(0).nullable(),
      body: z.string(),
    }),
  ),
  extras: z.array(
    z.object({
      label: z.string(),
      body: z.string(),
      minutes: z.number().int().min(0).nullable(),
    }),
  ),
});

export type PolishFields = z.infer<typeof polishFieldsSchema>;

export const POLISH_FIELDS_JSON_SHAPE = `{
  "standards": string,
  "agenda": string,
  "vocabulary": string,
  "entranceTicket": string,
  "materials": string,
  "opening": { "body": string, "minutes": number | null },
  "closing": { "body": string, "minutes": number | null },
  "workTimes": [ { "key": string, "label": string, "minutes": number | null, "body": string } ],
  "extras": [ { "label": string, "body": string, "minutes": number | null } ]
}`;

/** Pull the polishable surface from current lesson content (edited bodies). */
export function extractPolishFields(content: LessonPlanContent): PolishFields {
  return polishFieldsSchema.parse({
    standards: content.standards,
    agenda: content.agenda,
    vocabulary: content.vocabulary,
    entranceTicket: content.entranceTicket,
    materials: content.materials,
    opening: {
      body: content.opening.body,
      minutes: content.opening.minutes,
    },
    closing: {
      body: content.closing.body,
      minutes: content.closing.minutes,
    },
    workTimes: content.workTimes.map((block) => ({
      key: block.key,
      label: block.label,
      minutes: block.minutes,
      body: block.body,
    })),
    extras: content.extras.map((block) => ({
      label: block.label,
      body: block.body,
      minutes: block.minutes,
    })),
  });
}

/**
 * Merge polished fields into content.
 * Preserves images, links, bodyOriginal, bodySimplified, lessonDate, version,
 * workTimesReservoir, and work-time keys/order from the source plan.
 */
export function applyPolishFields(
  content: LessonPlanContent,
  polished: PolishFields,
): LessonPlanContent {
  const byKey = new Map(polished.workTimes.map((block) => [block.key, block]));

  return {
    ...content,
    standards: polished.standards,
    agenda: polished.agenda,
    vocabulary: polished.vocabulary,
    entranceTicket: polished.entranceTicket,
    materials: polished.materials,
    opening: {
      ...content.opening,
      body: polished.opening.body,
      minutes: polished.opening.minutes,
    },
    closing: {
      ...content.closing,
      body: polished.closing.body,
      minutes: polished.closing.minutes,
    },
    workTimes: content.workTimes.map((block) => {
      const next = byKey.get(block.key);
      if (!next) return block;
      return {
        ...block,
        label: next.label.trim() || block.label,
        minutes: next.minutes,
        body: next.body,
      };
    }),
    // Match by index when the model returns the same count; otherwise keep
    // existing extras (do not invent new extra slots from a bad response).
    extras: content.extras.map((block, index) => {
      const next = polished.extras[index];
      if (!next) return block;
      return {
        ...block,
        label: next.label.trim() || block.label,
        minutes: next.minutes,
        body: next.body,
      };
    }),
  };
}

/** Rehydrate every string field after the AI response (local names back). */
export function rehydratePolishFields(
  fields: PolishFields,
  rehydrate: (text: string) => string,
): PolishFields {
  return polishFieldsSchema.parse({
    standards: rehydrate(fields.standards),
    agenda: rehydrate(fields.agenda),
    vocabulary: rehydrate(fields.vocabulary),
    entranceTicket: rehydrate(fields.entranceTicket),
    materials: rehydrate(fields.materials),
    opening: {
      body: rehydrate(fields.opening.body),
      minutes: fields.opening.minutes,
    },
    closing: {
      body: rehydrate(fields.closing.body),
      minutes: fields.closing.minutes,
    },
    workTimes: fields.workTimes.map((block) => ({
      key: block.key,
      label: rehydrate(block.label),
      minutes: block.minutes,
      body: rehydrate(block.body),
    })),
    extras: fields.extras.map((block) => ({
      label: rehydrate(block.label),
      body: rehydrate(block.body),
      minutes: block.minutes,
    })),
  });
}

/**
 * Compact grouping summary for prompt context (labels + keys only).
 * Student ids are omitted — roster redaction covers names in free text/bodies.
 */
export function formatGroupsContext(sectionGroups: SectionGroupsMap): string {
  const lines: string[] = [];
  for (const [periodId, period] of Object.entries(sectionGroups)) {
    const groupBits = period.groups
      .map((group) => {
        const label = group.label.trim();
        const count = group.studentIds.length;
        if (!label && count === 0) return null;
        return `Group ${group.key}${label ? ` (${label})` : ""}: ${count} student(s)`;
      })
      .filter(Boolean);
    if (groupBits.length === 0) continue;
    lines.push(`Period ${periodId}:`);
    for (const bit of groupBits) {
      lines.push(`  - ${bit}`);
    }
  }
  return lines.join("\n");
}

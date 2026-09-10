import { z } from "zod";

/**
 * Per-period temporary groupings for a lesson draft.
 * Stored in lesson_plans.section_groups (jsonb), keyed by sections.id.
 * Unused / opted-out drafts keep {}.
 *
 * label = optional free-text on a group (facilitator, activity name, etc.).
 * studentIds = roster student row ids assigned to that group for this period.
 */

export const GROUP_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" as const;

const groupKeySchema = z
  .string()
  .min(1)
  .regex(/^[A-Z]$/, "group key must be A–Z");

export const sectionGroupSchema = z.object({
  key: groupKeySchema,
  /** Optional facilitator / activity label (not a student id). */
  label: z.string().default(""),
  studentIds: z.array(z.string().min(1)).default([]),
});

export const periodGroupsSchema = z.object({
  groups: z.array(sectionGroupSchema).min(1).max(GROUP_KEYS.length),
});

/** Map of section/period id → that period's group columns. */
export const sectionGroupsMapSchema = z.record(
  z.string().min(1),
  periodGroupsSchema,
);

export type SectionGroup = z.infer<typeof sectionGroupSchema>;
export type PeriodGroups = z.infer<typeof periodGroupsSchema>;
export type SectionGroupsMap = z.infer<typeof sectionGroupsMapSchema>;

export function groupKeyForIndex(index: number): string {
  if (index < 0 || index >= GROUP_KEYS.length) {
    throw new Error(`group index out of range: ${index}`);
  }
  return GROUP_KEYS[index]!;
}

export function emptySectionGroup(index: number): SectionGroup {
  return {
    key: groupKeyForIndex(index),
    label: "",
    studentIds: [],
  };
}

/** Default column count when the teacher first enables groupings. */
export const DEFAULT_GROUP_COUNT = 4;

export function emptyPeriodGroups(
  groupCount: number = DEFAULT_GROUP_COUNT,
): PeriodGroups {
  if (groupCount < 1 || groupCount > GROUP_KEYS.length) {
    throw new Error(`groupCount out of range: ${groupCount}`);
  }
  return {
    groups: Array.from({ length: groupCount }, (_, i) => emptySectionGroup(i)),
  };
}

export function emptySectionGroups(): SectionGroupsMap {
  return {};
}

export function parseSectionGroups(raw: unknown): SectionGroupsMap {
  if (raw == null || (typeof raw === "object" && Object.keys(raw as object).length === 0)) {
    return {};
  }
  return sectionGroupsMapSchema.parse(raw);
}

export function safeParseSectionGroups(raw: unknown) {
  if (raw == null || (typeof raw === "object" && Object.keys(raw as object).length === 0)) {
    return { success: true as const, data: {} as SectionGroupsMap };
  }
  return sectionGroupsMapSchema.safeParse(raw);
}

function rekeySectionGroup(group: SectionGroup, index: number): SectionGroup {
  return {
    ...group,
    key: groupKeyForIndex(index),
    label: group.label ?? "",
    studentIds: group.studentIds ?? [],
  };
}

/**
 * Grow/shrink group columns for one period. Re-keys to A, B, C…
 * Shrinking drops trailing columns (no reservoir — groups are ephemeral).
 */
export function resizePeriodGroups(
  period: PeriodGroups,
  count: number,
): PeriodGroups {
  if (count < 1 || count > GROUP_KEYS.length) {
    throw new Error(`groupCount out of range: ${count}`);
  }

  let groups = [...period.groups];
  if (count < groups.length) {
    groups = groups.slice(0, count);
  } else {
    while (groups.length < count) {
      groups.push(emptySectionGroup(groups.length));
    }
  }

  return {
    groups: groups.map((group, index) => rekeySectionGroup(group, index)),
  };
}

/** True when any period has a non-empty label or at least one student. */
export function hasSectionGroups(map: SectionGroupsMap): boolean {
  return Object.values(map).some((period) =>
    period.groups.some(
      (group) => group.label.trim().length > 0 || group.studentIds.length > 0,
    ),
  );
}

/**
 * Drop periods with no content. Returns {} when nothing remains
 * (drafts that opted out or cleared groupings).
 */
export function pruneEmptySectionGroups(map: SectionGroupsMap): SectionGroupsMap {
  const next: SectionGroupsMap = {};
  for (const [sectionId, period] of Object.entries(map)) {
    const groups = period.groups.map((group, index) =>
      rekeySectionGroup(group, index),
    );
    const hasContent = groups.some(
      (group) => group.label.trim().length > 0 || group.studentIds.length > 0,
    );
    if (hasContent) {
      next[sectionId] = { groups };
    }
  }
  return next;
}

import {
  DEFAULT_GROUP_COUNT,
  emptyPeriodGroups,
  GROUP_KEYS,
  hasSectionGroups,
  resizePeriodGroups,
  type SectionGroupsMap,
} from "../sectionGroups";
import type { PeriodRosterStudent, PeriodWithRoster } from "@/lib/roster/periods";

export type ExportGroupingsTable = {
  columnKeys: string[];
  rows: {
    periodName: string;
    cells: string[];
  }[];
};

function studentLabel(student: PeriodRosterStudent): string {
  if (student.nickname?.trim()) {
    return `${student.name} (${student.nickname.trim()})`;
  }
  return student.name;
}

function columnCountFromMap(map: SectionGroupsMap): number {
  let max = 0;
  for (const period of Object.values(map)) {
    max = Math.max(max, period.groups.length);
  }
  return max > 0 ? max : DEFAULT_GROUP_COUNT;
}

function syncMatrix(
  periods: PeriodWithRoster[],
  map: SectionGroupsMap,
  groupCount: number,
): SectionGroupsMap {
  const next: SectionGroupsMap = {};
  for (const period of periods) {
    const existing = map[period.id];
    next[period.id] = existing
      ? resizePeriodGroups(existing, groupCount)
      : emptyPeriodGroups(groupCount);
  }
  return next;
}

/**
 * Build a printable groupings matrix for .docx export.
 * Returns null when there are no periods or no filled groups.
 */
export function buildExportGroupingsTable(
  periods: PeriodWithRoster[],
  sectionGroups: SectionGroupsMap,
): ExportGroupingsTable | null {
  if (periods.length === 0 || !hasSectionGroups(sectionGroups)) {
    return null;
  }

  const groupCount = columnCountFromMap(sectionGroups);
  const matrix = syncMatrix(periods, sectionGroups, groupCount);
  const columnKeys = Array.from(
    { length: groupCount },
    (_, i) => GROUP_KEYS[i]!,
  );

  const rows = periods.map((period) => {
    const row = matrix[period.id] ?? emptyPeriodGroups(groupCount);
    const cells = row.groups.map((group) => {
      const names = group.studentIds
        .map((id) => {
          const student = period.students.find((s) => s.id === id);
          return student ? studentLabel(student) : null;
        })
        .filter(Boolean) as string[];
      const label = group.label.trim();
      return [...(label ? [label] : []), ...names].join("\n");
    });
    return {
      periodName: period.name,
      cells,
    };
  });

  return { columnKeys, rows };
}

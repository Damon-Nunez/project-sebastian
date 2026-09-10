"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_GROUP_COUNT,
  emptyPeriodGroups,
  emptySectionGroups,
  GROUP_KEYS,
  hasSectionGroups,
  resizePeriodGroups,
  type SectionGroupsMap,
} from "@/lib/lessons/sectionGroups";
import type {
  PeriodRosterStudent,
  PeriodWithRoster,
} from "@/lib/roster/periodRosters";

const labelClass =
  "text-xs font-medium uppercase tracking-wide text-slate-500";

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

/** Ensure every period has the same column count for the matrix view. */
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

type GroupingsEditorProps = {
  periods: PeriodWithRoster[];
  sectionGroups: SectionGroupsMap;
  onChange: (next: SectionGroupsMap) => void;
};

export function GroupingsEditor({
  periods,
  sectionGroups,
  onChange,
}: GroupingsEditorProps) {
  const [enabled, setEnabled] = useState(() =>
    hasSectionGroups(sectionGroups),
  );

  const groupCount = useMemo(
    () => columnCountFromMap(sectionGroups),
    [sectionGroups],
  );

  const matrix = useMemo(
    () => (enabled ? syncMatrix(periods, sectionGroups, groupCount) : {}),
    [enabled, periods, sectionGroups, groupCount],
  );

  function enable() {
    if (periods.length === 0) return;
    const seeded = syncMatrix(periods, emptySectionGroups(), DEFAULT_GROUP_COUNT);
    setEnabled(true);
    onChange(seeded);
  }

  function disable() {
    setEnabled(false);
    onChange(emptySectionGroups());
  }

  function setGroupCount(count: number) {
    if (count < 1 || count > GROUP_KEYS.length) return;
    onChange(syncMatrix(periods, sectionGroups, count));
  }

  function updatePeriodGroup(
    periodId: string,
    groupIndex: number,
    patch: { label?: string; studentIds?: string[] },
  ) {
    const synced = syncMatrix(periods, sectionGroups, groupCount);
    const period = synced[periodId];
    if (!period) return;
    const groups = period.groups.map((group, index) => {
      if (index !== groupIndex) return group;
      return {
        ...group,
        label: patch.label !== undefined ? patch.label : group.label,
        studentIds:
          patch.studentIds !== undefined ? patch.studentIds : group.studentIds,
      };
    });
    onChange({ ...synced, [periodId]: { groups } });
  }

  function toggleStudent(
    periodId: string,
    groupIndex: number,
    studentId: string,
  ) {
    const period = matrix[periodId];
    if (!period) return;
    const group = period.groups[groupIndex];
    if (!group) return;

    if (group.studentIds.includes(studentId)) {
      updatePeriodGroup(periodId, groupIndex, {
        studentIds: group.studentIds.filter((id) => id !== studentId),
      });
      return;
    }

    // Move student out of any other group in this period, then add here.
    const synced = syncMatrix(periods, sectionGroups, groupCount);
    const current = synced[periodId];
    if (!current) return;
    const groups = current.groups.map((g, index) => {
      const without = g.studentIds.filter((id) => id !== studentId);
      if (index === groupIndex) {
        return { ...g, studentIds: [...without, studentId] };
      }
      return { ...g, studentIds: without };
    });
    onChange({ ...synced, [periodId]: { groups } });
  }

  if (periods.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <div>
          <span className={labelClass}>Groupings</span>
          <p className="mt-0.5 text-xs text-slate-500">
            Optional — per-period student groups for this lesson only.
          </p>
        </div>
        <p className="text-sm text-slate-600">
          No periods in your account yet. Add classes under Periods, then you can
          build a groupings table here.
        </p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-linear-to-br from-white to-sky-50/40 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className={labelClass}>Groupings</span>
            <p className="mt-0.5 text-xs text-slate-500">
              Optional — not on every lesson. Add when you need Group A / B / C…
              per class.
            </p>
          </div>
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            Optional
          </span>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          Build a Class × Group grid for{" "}
          <span className="font-medium text-slate-800">
            {periods.map((p) => p.name).join(", ")}
          </span>
          . Assign students into as many groups as you need.
        </p>
        <button
          type="button"
          className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-medium text-sky-900 shadow-sm hover:bg-sky-50"
          onClick={enable}
        >
          Add groupings
        </button>
      </div>
    );
  }

  const headers = Array.from({ length: groupCount }, (_, i) => GROUP_KEYS[i]!);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">
            Groupings
          </span>
          <p className="mt-1 text-xs text-slate-500">
            Rows are your periods. Columns are groups — change the count anytime.
            Optional label (e.g. facilitator) plus student chips per cell.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            Groups
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none focus:border-slate-500"
              value={groupCount}
              onChange={(e) => setGroupCount(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={disable}
          >
            Remove groupings
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-300">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-10 border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-800">
                Class
              </th>
              {headers.map((key) => (
                <th
                  key={key}
                  className="border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-800"
                >
                  Group {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => {
              const row = matrix[period.id] ?? emptyPeriodGroups(groupCount);
              return (
                <tr key={period.id} className="align-top">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                  >
                    <div>{period.name}</div>
                    <div className="mt-0.5 text-[11px] font-normal text-slate-500">
                      {period.students.length} student
                      {period.students.length === 1 ? "" : "s"}
                    </div>
                  </th>
                  {row.groups.map((group, groupIndex) => {
                    const assigned = new Set(group.studentIds);
                    const chipStudents = group.studentIds
                      .map((id) => period.students.find((s) => s.id === id))
                      .filter(Boolean) as PeriodRosterStudent[];
                    const addable = period.students.filter(
                      (s) => !assigned.has(s.id),
                    );

                    function elsewhereKey(studentId: string): string | null {
                      const p = matrix[period.id];
                      if (!p) return null;
                      const hit = p.groups.find(
                        (g, i) =>
                          i !== groupIndex && g.studentIds.includes(studentId),
                      );
                      return hit?.key ?? null;
                    }

                    return (
                      <td
                        key={group.key}
                        className="min-w-44 border border-slate-300 bg-white p-2"
                      >
                        <input
                          className="mb-2 w-full rounded border border-transparent bg-slate-50 px-2 py-1 text-xs text-slate-600 outline-none placeholder:text-slate-400 hover:border-slate-200 focus:border-sky-400 focus:bg-white"
                          value={group.label}
                          onChange={(e) =>
                            updatePeriodGroup(period.id, groupIndex, {
                              label: e.target.value,
                            })
                          }
                          placeholder="Label (optional)"
                          aria-label={`${period.name} Group ${group.key} label`}
                        />
                        <div className="flex flex-wrap gap-1">
                          {chipStudents.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              className="inline-flex max-w-full items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-950 ring-1 ring-inset ring-sky-200 hover:bg-sky-100"
                              title="Click to remove"
                              onClick={() =>
                                toggleStudent(
                                  period.id,
                                  groupIndex,
                                  student.id,
                                )
                              }
                            >
                              <span className="truncate">
                                {studentLabel(student)}
                              </span>
                              <span aria-hidden className="text-sky-700">
                                ×
                              </span>
                            </button>
                          ))}
                        </div>
                        {period.students.length === 0 ? (
                          <p className="mt-1 text-[11px] text-slate-400">
                            No roster for this period.
                          </p>
                        ) : addable.length > 0 ? (
                          <select
                            className="mt-2 w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-sky-400"
                            value=""
                            aria-label={`Add student to ${period.name} Group ${group.key}`}
                            onChange={(e) => {
                              const id = e.target.value;
                              if (id) {
                                toggleStudent(period.id, groupIndex, id);
                              }
                            }}
                          >
                            <option value="">+ Add student</option>
                            {addable.map((student) => {
                              const from = elsewhereKey(student.id);
                              return (
                                <option key={student.id} value={student.id}>
                                  {studentLabel(student)}
                                  {from ? ` (from Group ${from})` : ""}
                                </option>
                              );
                            })}
                          </select>
                        ) : chipStudents.length > 0 ? (
                          <p className="mt-1 text-[11px] text-slate-400">
                            All students placed.
                          </p>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Left-pane draft preview — appears once any group has a student or label. */
export function GroupingsPreview({
  periods,
  sectionGroups,
}: {
  periods: PeriodWithRoster[];
  sectionGroups: SectionGroupsMap;
}) {
  if (!hasSectionGroups(sectionGroups)) return null;

  const groupCount = columnCountFromMap(sectionGroups);
  const matrix = syncMatrix(periods, sectionGroups, groupCount);
  const headers = Array.from({ length: groupCount }, (_, i) => GROUP_KEYS[i]!);

  return (
    <section className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <h3 className="text-sm font-semibold text-slate-900 underline decoration-slate-400 underline-offset-4">
        Groupings
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse border border-slate-800 text-left text-sm">
          <thead>
            <tr>
              <th className="border border-slate-800 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-800">
                Class
              </th>
              {headers.map((key) => (
                <th
                  key={key}
                  className="border border-slate-800 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-800"
                >
                  Group {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => {
              const row = matrix[period.id] ?? emptyPeriodGroups(groupCount);
              return (
                <tr key={period.id}>
                  <th
                    scope="row"
                    className="border border-slate-800 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900"
                  >
                    {period.name}
                  </th>
                  {row.groups.map((group) => {
                    const names = group.studentIds
                      .map((id) => {
                        const student = period.students.find((s) => s.id === id);
                        return student ? studentLabel(student) : null;
                      })
                      .filter(Boolean) as string[];
                    const label = group.label.trim();
                    const lines = [
                      ...(label ? [label] : []),
                      ...names,
                    ];
                    return (
                      <td
                        key={group.key}
                        className="border border-slate-800 bg-white px-2.5 py-1.5 align-top text-sm text-slate-700"
                      >
                        {lines.length > 0 ? (
                          <div className="whitespace-pre-wrap leading-5">
                            {lines.join("\n")}
                          </div>
                        ) : (
                          <span className="text-slate-300">&nbsp;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

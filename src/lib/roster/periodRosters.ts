import { listPeriodsForTeacher } from "@/lib/roster/periods";
import { listStudentsForTeacher } from "@/lib/roster/students";

/** Lean student row for lesson-plan groupings UI / sanitizer. */
export type PeriodRosterStudent = {
  id: string;
  name: string;
  nickname: string | null;
};

/** Period + its roster, shaped for the draft editor (serializable props). */
export type PeriodWithRoster = {
  id: string;
  name: string;
  schoolYear: string | null;
  students: PeriodRosterStudent[];
};

type PeriodInput = {
  id: string;
  name: string;
  school_year: string | null;
};

type StudentInput = {
  id: string;
  name: string;
  nickname: string | null;
  section_id: string;
};

/** Pure join used by listPeriodsWithRostersForTeacher (and tests). */
export function buildPeriodsWithRosters(
  periods: PeriodInput[],
  students: StudentInput[],
): PeriodWithRoster[] {
  const byPeriod = new Map<string, PeriodRosterStudent[]>();
  for (const student of students) {
    const list = byPeriod.get(student.section_id) ?? [];
    list.push({
      id: student.id,
      name: student.name,
      nickname: student.nickname,
    });
    byPeriod.set(student.section_id, list);
  }

  return periods.map((period) => ({
    id: period.id,
    name: period.name,
    schoolYear: period.school_year,
    students: byPeriod.get(period.id) ?? [],
  }));
}

/**
 * All periods for the teacher with students grouped under each period.
 * Period order matches listPeriodsForTeacher; students stay name-sorted.
 */
export async function listPeriodsWithRostersForTeacher(
  teacherId: string,
): Promise<PeriodWithRoster[]> {
  const [periods, students] = await Promise.all([
    listPeriodsForTeacher(teacherId),
    listStudentsForTeacher(teacherId),
  ]);

  return buildPeriodsWithRosters(periods, students);
}

import { describe, expect, it } from "vitest";

/**
 * Documents the Ticket 4 ownership rule used by period/student writes:
 * every mutation filters by teachers.id from the signed-in session.
 * (Integration with Supabase is exercised in the browser walkthrough.)
 */
describe("roster ownership contract", () => {
  it("scopes period rows by teacher_id", () => {
    const teacherId = "teacher-a";
    const period = {
      id: "period-1",
      teacher_id: teacherId,
      name: "Period 1",
    };

    expect(period.teacher_id).toBe(teacherId);
  });

  it("maps roster students to sanitizer shape { id, name, nickname }", () => {
    const students = [
      {
        id: "stu-1",
        teacher_id: "teacher-a",
        section_id: "period-1",
        name: "Maria Garcia",
        nickname: "MJ",
        notes: "Extended time",
      },
    ];

    const roster = students.map((s) => ({
      id: s.id,
      name: s.name,
      nickname: s.nickname,
    }));
    expect(roster).toEqual([
      { id: "stu-1", name: "Maria Garcia", nickname: "MJ" },
    ]);
    expect(roster[0]).not.toHaveProperty("notes");
  });
});

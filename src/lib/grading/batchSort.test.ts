import { describe, expect, it } from "vitest";
import type { DocumentRow } from "@/lib/db/types";
import type { PeriodWithRoster } from "@/lib/roster/periods";
import { keyWordOverlap, orderPagesForCombine, sortUnfiledWork } from "./batchSort";

const KEY = `1. Why does Esperanza feel ashamed of the house on Mango Street?
2. Describe the neighborhood and the family's previous apartment.
3. What promise does Esperanza make about leaving someday?`;

const ON_TOPIC = `Damon Nunez
1. Esperanza feels ashamed because the house on Mango Street is small and crumbling.
2. The neighborhood is crowded; the previous apartment on Loomis had broken water pipes.
3. She makes a promise that someday she will have a real house and leave.`;

const OFF_TOPIC = `Damon Nunez
Photosynthesis converts sunlight, water, and carbon dioxide into glucose and oxygen inside chloroplasts.`;

const periods: PeriodWithRoster[] = [
  {
    id: "p1",
    name: "Period 1",
    schoolYear: "2025-26",
    students: [
      { id: "s-damon", name: "Damon Nunez", nickname: null },
      { id: "s-maria", name: "Maria Garcia", nickname: null },
    ],
  },
  {
    id: "p2",
    name: "Period 2",
    schoolYear: "2025-26",
    students: [{ id: "s-maria2", name: "Maria Garcia", nickname: null }],
  },
];

function doc(overrides: Partial<DocumentRow>): DocumentRow {
  return {
    id: "d1",
    teacher_id: "t1",
    kind: "student_work",
    original_filename: "Damon Nunez.docx",
    storage_path: "t1/d1.docx",
    lesson_plan_id: null,
    grading_session_id: null,
    student_id: null,
    body_text: ON_TOPIC,
    needs_vision: false,
    assignment_id: "a1",
    vision_pages: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const answerKey = { reference_kind: "answer_key" as const, reference_text: KEY };

function sortOne(
  document: DocumentRow,
  assignment: Parameters<typeof sortUnfiledWork>[0]["assignment"] = answerKey,
  filed: string[] = [],
) {
  return sortUnfiledWork({
    assignment,
    documents: [document],
    periods,
    filedStudentIds: new Set(filed),
  })[0]!;
}

describe("keyWordOverlap", () => {
  it("scores on-topic work high and off-topic work low", () => {
    expect(keyWordOverlap(KEY, ON_TOPIC)!).toBeGreaterThan(0.5);
    expect(keyWordOverlap(KEY, OFF_TOPIC)!).toBeLessThan(0.1);
  });

  it("returns null when the key is too short to check", () => {
    expect(keyWordOverlap("1. True 2. False", ON_TOPIC)).toBeNull();
  });

  it("ignores case and stopwords", () => {
    const key = "Esperanza Mango Street neighborhood promise";
    expect(keyWordOverlap(key, "ESPERANZA mango STREET Neighborhood Promise")).toBe(1);
    expect(keyWordOverlap("which would their there these " + key, "esperanza")).toBe(0.2);
  });
});

describe("orderPagesForCombine", () => {
  it("orders by file name with numbers compared as numbers, then upload time", () => {
    const pages = [
      { id: "c", original_filename: "IMG_10.jpg", created_at: "2026-10-01T00:00:01Z" },
      { id: "a", original_filename: "IMG_9.jpg", created_at: "2026-10-01T00:00:03Z" },
      { id: "b2", original_filename: "scan.jpg", created_at: "2026-10-01T00:00:05Z" },
      { id: "b1", original_filename: "scan.jpg", created_at: "2026-10-01T00:00:04Z" },
    ];
    expect(orderPagesForCombine(pages).map((p) => p.id)).toEqual(["a", "c", "b1", "b2"]);
  });
});

describe("sortUnfiledWork", () => {
  it("marks a clean match with an answer key as ready", () => {
    const result = sortOne(doc({}));
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.student).toMatchObject({ studentId: "s-damon", periodId: "p1" });
    }
  });

  it("sends photos OCR couldn't read to Unsorted but keeps the filename guess", () => {
    const result = sortOne(doc({ needs_vision: true, body_text: null }));
    expect(result).toMatchObject({
      status: "unsorted",
      reason: "photo",
      suggestedStudentId: "s-damon",
    });
  });

  it("sorts photos from their OCR text like typed work", () => {
    const result = sortOne(
      doc({ original_filename: "IMG_4821.jpg", needs_vision: true, body_text: ON_TOPIC }),
    );
    expect(result).toMatchObject({ status: "ready", student: { studentId: "s-damon" } });
  });

  it("flags two photos of one student as possible pages", () => {
    const photo = { original_filename: "IMG_1.jpg", needs_vision: true };
    const results = sortUnfiledWork({
      assignment: answerKey,
      documents: [doc({ ...photo, id: "d1" }), doc({ ...photo, id: "d2" })],
      periods,
      filedStudentIds: new Set(),
    });
    expect(results.map((r) => r.status === "unsorted" && r.reason)).toEqual([
      "multi_page",
      "multi_page",
    ]);
  });

  it("sends unknown and ambiguous students to Unsorted", () => {
    expect(
      sortOne(doc({ original_filename: "IMG_4821.docx", body_text: KEY })),
    ).toMatchObject({ status: "unsorted", reason: "no_student" });
    expect(
      sortOne(doc({ original_filename: "Maria Garcia.docx" })),
    ).toMatchObject({ status: "unsorted", reason: "ambiguous_student" });
  });

  it("flags both copies when one student appears twice in the batch", () => {
    const results = sortUnfiledWork({
      assignment: answerKey,
      documents: [doc({ id: "d1" }), doc({ id: "d2" })],
      periods,
      filedStudentIds: new Set(),
    });
    expect(results.map((r) => r.status === "unsorted" && r.reason)).toEqual([
      "duplicate_in_batch",
      "duplicate_in_batch",
    ]);
  });

  it("flags a student who already has filed work", () => {
    expect(sortOne(doc({}), answerKey, ["s-damon"])).toMatchObject({
      reason: "already_filed",
    });
  });

  it("sends everything to Unsorted without an answer key", () => {
    for (const reference_kind of ["exemplar", "none"] as const) {
      expect(
        sortOne(doc({}), { reference_kind, reference_text: KEY }),
      ).toMatchObject({ status: "unsorted", reason: "no_answer_key" });
    }
  });

  it("flags low overlap with the key", () => {
    expect(sortOne(doc({ body_text: OFF_TOPIC }))).toMatchObject({
      status: "unsorted",
      reason: "low_overlap",
      suggestedStudentId: "s-damon",
    });
  });
});

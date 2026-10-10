import { describe, expect, it } from "vitest";
import type { GradingSuggestionRow } from "@/lib/db/types";
import type { RubricCriteria } from "@/lib/rubrics/criteria";
import type { GradeDetail } from "./gradeWork";
import {
  buildClassSummaryRows,
  formatWhyThisRange,
  gradedAgainstOlderKey,
  parseGradeDetail,
  stripAnswerMarkers,
  type SessionPaper,
} from "./results";

function paper(partial: {
  studentId: string;
  studentName: string;
  ai_status?: GradingSuggestionRow["ai_status"];
  status?: GradingSuggestionRow["status"];
  suggested_range_low?: number | null;
  suggested_range_high?: number | null;
  suggested_comment?: string | null;
  teacher_grade?: number | null;
  teacher_comment?: string | null;
  accommodation_flagged?: boolean;
}): SessionPaper {
  const suggestion = {
    id: `sug-${partial.studentId}`,
    teacher_id: "t1",
    grading_session_id: "s1",
    student_id: partial.studentId,
    document_id: "d1",
    suggested_range_low: partial.suggested_range_low ?? null,
    suggested_range_high: partial.suggested_range_high ?? null,
    suggested_comment: partial.suggested_comment ?? null,
    accommodation_flagged: partial.accommodation_flagged ?? false,
    teacher_grade: partial.teacher_grade ?? null,
    teacher_comment: partial.teacher_comment ?? null,
    status: partial.status ?? "draft",
    ai_status: partial.ai_status ?? null,
    grading_detail: null,
    graded_reference_at: null,
    created_at: "",
    updated_at: "",
  } satisfies GradingSuggestionRow;

  return {
    suggestion,
    studentName: partial.studentName,
    filename: "work.docx",
    storagePath: "path",
    visionPages: [],
    detail: null,
  };
}

describe("parseGradeDetail", () => {
  it("accepts version 1 detail and rejects anything else", () => {
    const detail = { version: 1, items: [], categoryScores: [], percent: 88 };
    expect(parseGradeDetail(detail)).toEqual(detail);
    expect(parseGradeDetail({ ...detail, version: 2 })).toBeNull();
    expect(parseGradeDetail({ version: 1 })).toBeNull();
    expect(parseGradeDetail(null)).toBeNull();
  });
});

describe("stripAnswerMarkers", () => {
  it("removes formatting markers but keeps the words", () => {
    expect(stripAnswerMarkers("B) [[hl]]ashamed[[/hl]] [[s]]C)[[/s]]")).toBe(
      "B) ashamed C)",
    );
  });
});

const criteria = {
  version: 1,
  scale: { min: 1, max: 4, percentMin: null, percentMax: null },
  levels: [
    { id: "meets", score: 3, label: "Meets" },
    { id: "blank", score: 2, label: "" },
  ],
  categories: [{ id: "ideas", name: "Ideas", weight: null }],
  cells: [],
} satisfies RubricCriteria;

function gradeDetail(
  partial: Partial<GradeDetail> & Pick<GradeDetail, "mode">,
): GradeDetail {
  return {
    version: 1,
    percent: 85,
    earnedPoints: null,
    totalPoints: null,
    referenceKind: "answer_key",
    items: [],
    categoryScores: [],
    accommodationNote: null,
    model: "test",
    ...partial,
  };
}

describe("formatWhyThisRange", () => {
  it("copies question verdicts, rubric names, and the points note", () => {
    const text = formatWhyThisRange(
      gradeDetail({
        mode: "points",
        earnedPoints: 2.5,
        totalPoints: 4,
        items: [
          {
            label: "1",
            kind: "key",
            studentAnswer: "[[hl]]ashamed[[/hl]]",
            expectedAnswer: "ashamed",
            verdict: "partial",
            rubricLevel: null,
            maxPoints: 2.5,
            reason: "Named the feeling but missed the cause.",
          },
          {
            label: "2",
            kind: "rubric",
            studentAnswer: "",
            expectedAnswer: null,
            verdict: null,
            rubricLevel: 3,
            maxPoints: null,
            reason: "Clear claim with one example.",
          },
        ],
        categoryScores: [
          { categoryId: "ideas", level: 3, reason: "Focused on the prompt." },
          { categoryId: "unknown", level: 2, reason: "Thin evidence." },
        ],
      }),
      criteria,
    );

    expect(text).toBe(
      [
        "Q1 · ½ credit · 2.5 pts",
        "Named the feeling but missed the cause.",
        "Student: “ashamed” · Key: “ashamed”",
        "",
        "Q2 · Rubric 3 · Meets",
        "Clear claim with one example.",
        "",
        "Ideas — 3 · Meets. Focused on the prompt.",
        "unknown — 2 · Level 2. Thin evidence.",
        "",
        "Points come from the answer key; ½ credit is noted per question. Range is the score ±2.",
      ].join("\n"),
    );
  });

  it("uses the rubric note when the key has no points", () => {
    const text = formatWhyThisRange(
      gradeDetail({ mode: "rubric", referenceKind: "none" }),
      null,
    );

    expect(text).toBe(
      "No points on the key, so the rubric levels above set the grade. Range is the score ±2.",
    );
  });
});

describe("gradedAgainstOlderKey", () => {
  it("flags grades made before the key changed", () => {
    expect(
      gradedAgainstOlderKey("2026-10-01T10:00:00+00:00", "2026-10-01T11:00:00Z"),
    ).toBe(true);
    expect(
      gradedAgainstOlderKey("2026-10-01T11:00:00+00:00", "2026-10-01T11:00:00Z"),
    ).toBe(false);
    expect(gradedAgainstOlderKey(null, "2026-10-01T11:00:00Z")).toBe(false);
  });
});

describe("buildClassSummaryRows", () => {
  it("marks roster students without a paper as Missing", () => {
    const rows = buildClassSummaryRows({
      students: [
        { id: "a", name: "Ana" },
        { id: "b", name: "Ben" },
      ],
      papers: [
        paper({
          studentId: "a",
          studentName: "Ana",
          ai_status: "graded",
          suggested_range_low: 78,
          suggested_range_high: 83,
          suggested_comment: "Strong analysis.",
        }),
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      studentName: "Ana",
      missing: false,
      gradeLabel: "78–83%",
      comment: "Strong analysis.",
      statusLabel: "Graded",
    });
    expect(rows[1]).toMatchObject({
      studentName: "Ben",
      missing: true,
      gradeLabel: null,
      statusLabel: "Missing",
    });
  });

  it("prefers final teacher grade and comment when marked final", () => {
    const rows = buildClassSummaryRows({
      students: [{ id: "a", name: "Ana" }],
      papers: [
        paper({
          studentId: "a",
          studentName: "Ana",
          ai_status: "graded",
          status: "final",
          suggested_range_low: 78,
          suggested_range_high: 83,
          suggested_comment: "AI comment",
          teacher_grade: 80,
          teacher_comment: "Teacher comment",
        }),
      ],
    });

    expect(rows[0]).toMatchObject({
      gradeLabel: "80%",
      comment: "Teacher comment",
      statusLabel: "Final",
      missing: false,
    });
  });

  it("keeps papers for students no longer on the roster", () => {
    const rows = buildClassSummaryRows({
      students: [{ id: "a", name: "Ana" }],
      papers: [
        paper({
          studentId: "z",
          studentName: "Zed",
          ai_status: "pending",
        }),
      ],
    });

    expect(rows.map((r) => r.studentName)).toEqual(["Ana", "Zed"]);
    expect(rows[0]?.missing).toBe(true);
    expect(rows[1]).toMatchObject({
      missing: false,
      statusLabel: "Waiting to grade",
    });
  });
});

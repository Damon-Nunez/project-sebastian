/**
 * Shape of the AI grading response (Ticket 10 / SCRUM-130). The AI judges
 * each question and rubric category; `score.ts` turns that into the percent.
 */
import { z } from "zod";
import type { RubricCriteria } from "@/lib/rubrics/criteria";

/** A partial-credit reason shorter than this can't name what was missing. */
const MIN_PARTIAL_REASON_CHARS = 12;

export const VERDICTS = [
  "correct",
  "partial",
  "incorrect",
  "unanswered",
  "unreadable",
] as const;
export type Verdict = (typeof VERDICTS)[number];

const gradedItemSchema = z
  .object({
    label: z.string().min(1),
    /** key = right/wrong against the reference; rubric = extended response scored on the rubric. */
    kind: z.enum(["key", "rubric"]),
    studentAnswer: z.string(),
    expectedAnswer: z.string().nullable(),
    verdict: z.enum(VERDICTS).nullable(),
    rubricLevel: z.number().finite().nullable(),
    /** Only when the reference states points for this question. */
    maxPoints: z.number().positive().nullable(),
    reason: z.string().min(1),
  })
  .superRefine((item, ctx) => {
    if (item.kind === "key" && item.verdict === null) {
      ctx.addIssue({ code: "custom", message: `${item.label}: key item needs a verdict` });
    }
    if (item.kind === "rubric" && item.rubricLevel === null) {
      ctx.addIssue({ code: "custom", message: `${item.label}: rubric item needs a rubricLevel` });
    }
    if (
      item.verdict === "partial" &&
      item.reason.trim().length < MIN_PARTIAL_REASON_CHARS
    ) {
      ctx.addIssue({
        code: "custom",
        message: `${item.label}: partial credit needs a specific reason`,
      });
    }
  });

export const aiGradeSchema = z.object({
  items: z.array(gradedItemSchema),
  categoryScores: z.array(
    z.object({
      categoryId: z.string().min(1),
      level: z.number().finite(),
      reason: z.string().min(1),
    }),
  ),
  comment: z.string().min(1),
  accommodationConsidered: z.boolean(),
  accommodationNote: z.string().nullable(),
});

export type GradedItem = z.infer<typeof gradedItemSchema>;
export type AiGrade = z.infer<typeof aiGradeSchema>;

export const AI_GRADE_JSON_SHAPE = `{
  "items": [
    {
      "label": "1",
      "kind": "key" | "rubric",
      "studentAnswer": "what the student wrote (short quote)",
      "expectedAnswer": "what the reference expects, or null",
      "verdict": "correct" | "partial" | "incorrect" | "unanswered" | "unreadable" | null,
      "rubricLevel": number | null,
      "maxPoints": number | null,
      "reason": "one specific sentence"
    }
  ],
  "categoryScores": [{ "categoryId": "id from the rubric", "level": number, "reason": "one sentence" }],
  "comment": "2-4 sentences for the teacher",
  "accommodationConsidered": boolean,
  "accommodationNote": "how the notes were applied, or null"
}`;

/** Rubric-level checks the schema can't do alone: every category once, real level scores. */
export function rubricIssues(grade: AiGrade, criteria: RubricCriteria): string[] {
  const issues: string[] = [];
  const levelScores = new Set(criteria.levels.map((level) => level.score));
  const seen = new Set<string>();

  for (const score of grade.categoryScores) {
    if (!criteria.categories.some((c) => c.id === score.categoryId)) {
      issues.push(`unknown categoryId ${score.categoryId}`);
    }
    if (seen.has(score.categoryId)) issues.push(`duplicate ${score.categoryId}`);
    seen.add(score.categoryId);
    if (!levelScores.has(score.level)) {
      issues.push(`${score.categoryId}: level ${score.level} is not on the rubric`);
    }
  }
  for (const category of criteria.categories) {
    if (!seen.has(category.id)) issues.push(`missing category ${category.id}`);
  }
  for (const item of grade.items) {
    if (item.rubricLevel !== null && !levelScores.has(item.rubricLevel)) {
      issues.push(`${item.label}: level ${item.rubricLevel} is not on the rubric`);
    }
  }
  return issues;
}

/**
 * Deterministic score + range from the AI's per-question verdicts
 * (Ticket 10 / SCRUM-130). The AI never produces the percent itself.
 *
 * - points: the reference states points for every question → sum them.
 *   Key questions: correct 1, partial ½, otherwise 0. Rubric questions:
 *   the level's percent of that question's points.
 * - rubric: no points stated (or no questions) → daily rubric decides,
 *   weighted average of category level percents.
 */
import type { RubricCriteria, RubricScale } from "@/lib/rubrics/criteria";
import type { AiGrade, Verdict } from "./gradeSchema";

/** Default level → percent when the rubric has no percent hints: 4/3/2/1 → 95/85/75/65. */
const DEFAULT_PERCENT_LOW = 65;
const DEFAULT_PERCENT_HIGH = 95;
const RANGE_HALF_WIDTH = 2;

const VERDICT_CREDIT: Record<Verdict, number> = {
  correct: 1,
  partial: 0.5,
  incorrect: 0,
  unanswered: 0,
  unreadable: 0,
};

export type ScoreMode = "points" | "rubric";

export type ComputedGrade = {
  mode: ScoreMode;
  percent: number;
  rangeLow: number;
  rangeHigh: number;
  earnedPoints: number | null;
  totalPoints: number | null;
};

export function levelPercent(level: number, scale: RubricScale): number {
  const low = scale.percentMin ?? DEFAULT_PERCENT_LOW;
  const high = scale.percentMax ?? DEFAULT_PERCENT_HIGH;
  if (scale.max === scale.min) return high;
  const t = (level - scale.min) / (scale.max - scale.min);
  return low + Math.min(1, Math.max(0, t)) * (high - low);
}

function rubricPercent(grade: AiGrade, criteria: RubricCriteria): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const category of criteria.categories) {
    const score = grade.categoryScores.find((s) => s.categoryId === category.id);
    if (!score) continue;
    const weight = category.weight ?? 1;
    weighted += levelPercent(score.level, criteria.scale) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weighted / totalWeight : 0;
}

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export function computeGrade(input: {
  grade: AiGrade;
  criteria: RubricCriteria;
  /** False for "none" references — points can't come from nowhere. */
  hasReference: boolean;
}): ComputedGrade {
  const { grade, criteria } = input;
  const usePoints =
    input.hasReference &&
    grade.items.length > 0 &&
    grade.items.every((item) => item.maxPoints !== null);

  if (!usePoints) {
    const percent = rubricPercent(grade, criteria);
    return {
      mode: "rubric",
      percent,
      rangeLow: clamp(percent - RANGE_HALF_WIDTH),
      rangeHigh: clamp(percent + RANGE_HALF_WIDTH),
      earnedPoints: null,
      totalPoints: null,
    };
  }

  let earned = 0;
  let total = 0;
  let unreadable = 0;
  for (const item of grade.items) {
    const max = item.maxPoints!;
    total += max;
    if (item.kind === "rubric") {
      earned += (levelPercent(item.rubricLevel!, criteria.scale) / 100) * max;
    } else {
      earned += VERDICT_CREDIT[item.verdict!] * max;
      if (item.verdict === "unreadable") unreadable += max;
    }
  }

  const percent = (earned / total) * 100;
  const widen = (unreadable / total) * 100;
  return {
    mode: "points",
    percent,
    rangeLow: clamp(percent - RANGE_HALF_WIDTH),
    rangeHigh: clamp(percent + RANGE_HALF_WIDTH + widen),
    earnedPoints: earned,
    totalPoints: total,
  };
}

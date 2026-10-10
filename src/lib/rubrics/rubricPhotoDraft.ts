/**
 * Turn a rubric-photo LLM JSON object into the editor's criteria grid.
 * Pure — no AI call. The teacher still reviews before save.
 */
import { z } from "zod";
import { rubricCriteriaSchema, type RubricCriteria } from "./criteria";

export const MAX_RUBRIC_PHOTO_PAGES = 4;

export const RUBRIC_PHOTO_ACCEPT =
  ".jpg,.jpeg,.png,.heic,.heif,.pdf,image/jpeg,image/png,image/heic,image/heif,application/pdf";

const draftSchema = z.object({
  name: z.string().optional(),
  levels: z
    .array(
      z.object({
        score: z.coerce.number().finite(),
        label: z.string().optional().default(""),
      }),
    )
    .min(1)
    .max(8),
  categories: z
    .array(
      z.object({
        name: z.string(),
        weight: z.unknown().optional(),
        descriptors: z.record(z.string(), z.string()).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export class RubricPhotoDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RubricPhotoDraftError";
  }
}

function optionalWeight(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function descriptorFor(
  descriptors: Record<string, string> | undefined,
  score: number,
): string {
  if (!descriptors) return "";
  const exact = descriptors[String(score)];
  if (typeof exact === "string") return exact.trim();
  const match = Object.entries(descriptors).find(([key]) => Number(key) === score);
  return match?.[1]?.trim() ?? "";
}

/** Map photo JSON into a complete rubric grid (high score first). */
export function rubricCriteriaFromPhotoDraft(input: unknown): {
  name: string | null;
  criteria: RubricCriteria;
} {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) {
    throw new RubricPhotoDraftError(
      "Couldn't read that rubric. Try a clearer photo, or type it in.",
    );
  }

  const seenScores = new Set<number>();
  const levels = [...parsed.data.levels]
    .filter((level) => {
      if (seenScores.has(level.score)) return false;
      seenScores.add(level.score);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .map((level, index) => ({
      id: `level-${index + 1}`,
      score: level.score,
      label: level.label.trim(),
    }));

  const categories = parsed.data.categories
    .map((category) => ({
      name: category.name.trim(),
      weight: optionalWeight(category.weight),
      descriptors: category.descriptors,
    }))
    .filter((category) => category.name.length > 0)
    .map((category, index) => ({
      id: `category-${index + 1}`,
      name: category.name,
      weight: category.weight,
      descriptors: category.descriptors,
    }));

  if (levels.length === 0 || categories.length === 0) {
    throw new RubricPhotoDraftError(
      "Couldn't read that rubric. Try a clearer photo, or type it in.",
    );
  }

  const criteria = rubricCriteriaSchema.parse({
    version: 1,
    scale: {
      min: Math.min(...levels.map((level) => level.score)),
      max: Math.max(...levels.map((level) => level.score)),
      percentMin: null,
      percentMax: null,
    },
    levels: levels.map(({ id, score, label }) => ({ id, score, label })),
    categories: categories.map(({ id, name, weight }) => ({ id, name, weight })),
    cells: categories.flatMap((category) =>
      levels.map((level) => ({
        categoryId: category.id,
        levelId: level.id,
        description: descriptorFor(category.descriptors, level.score),
      })),
    ),
  });

  const name = parsed.data.name?.trim() || null;
  return { name, criteria };
}

import { z } from "zod";

/**
 * Ticket 8 / Approach C (hybrid): levels + categories + per-cell descriptors.
 * Lives in rubrics.criteria (jsonb). Copy-friendly for teacher setup — not lesson-export chrome.
 *
 * Weights are optional (null = unset / treat as equal later). No mandatory sum-to-100 in MVP.
 */

const idSchema = z.string().min(1);

export const rubricLevelSchema = z.object({
  id: idSchema,
  /** Numeric score for this column (e.g. 4, 3, 2, 1). */
  score: z.number().finite(),
  /** Display label (e.g. "Exceeds Standards"). */
  label: z.string(),
});

export const rubricCategorySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** Relative weight 0–100, or null when the teacher leaves weights unset. */
  weight: z.number().min(0).max(100).nullable().default(null),
});

export const rubricCellSchema = z.object({
  categoryId: idSchema,
  levelId: idSchema,
  /** Descriptor text for this category at this level (paste from their sheet). */
  description: z.string().default(""),
});

export const rubricScaleSchema = z.object({
  /** Inclusive score floor among levels (usually 1). */
  min: z.number().finite(),
  /** Inclusive score ceiling among levels (usually 4). */
  max: z.number().finite(),
  /**
   * Optional hint for later Jupiter-style 0–100 ranges.
   * Null in MVP when the teacher grades on level scores only.
   */
  percentMin: z.number().min(0).max(100).nullable().default(null),
  percentMax: z.number().min(0).max(100).nullable().default(null),
});

export const rubricCriteriaSchema = z
  .object({
    version: z.literal(1),
    scale: rubricScaleSchema,
    levels: z.array(rubricLevelSchema).min(1),
    categories: z.array(rubricCategorySchema).min(1),
    cells: z.array(rubricCellSchema),
  })
  .superRefine((data, ctx) => {
    if (data.scale.min > data.scale.max) {
      ctx.addIssue({
        code: "custom",
        message: "scale.min must be <= scale.max",
        path: ["scale", "min"],
      });
    }

    const levelIds = new Set(data.levels.map((l) => l.id));
    if (levelIds.size !== data.levels.length) {
      ctx.addIssue({
        code: "custom",
        message: "level ids must be unique",
        path: ["levels"],
      });
    }

    const categoryIds = new Set(data.categories.map((c) => c.id));
    if (categoryIds.size !== data.categories.length) {
      ctx.addIssue({
        code: "custom",
        message: "category ids must be unique",
        path: ["categories"],
      });
    }

    const cellKeys = new Set<string>();
    for (const [i, cell] of data.cells.entries()) {
      if (!categoryIds.has(cell.categoryId)) {
        ctx.addIssue({
          code: "custom",
          message: `unknown categoryId: ${cell.categoryId}`,
          path: ["cells", i, "categoryId"],
        });
      }
      if (!levelIds.has(cell.levelId)) {
        ctx.addIssue({
          code: "custom",
          message: `unknown levelId: ${cell.levelId}`,
          path: ["cells", i, "levelId"],
        });
      }
      const key = `${cell.categoryId}::${cell.levelId}`;
      if (cellKeys.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate cell for ${key}`,
          path: ["cells", i],
        });
      }
      cellKeys.add(key);
    }

    for (const category of data.categories) {
      for (const level of data.levels) {
        const key = `${category.id}::${level.id}`;
        if (!cellKeys.has(key)) {
          ctx.addIssue({
            code: "custom",
            message: `missing cell for category ${category.id} / level ${level.id}`,
            path: ["cells"],
          });
        }
      }
    }
  });

export type RubricLevel = z.infer<typeof rubricLevelSchema>;
export type RubricCategory = z.infer<typeof rubricCategorySchema>;
export type RubricCell = z.infer<typeof rubricCellSchema>;
export type RubricScale = z.infer<typeof rubricScaleSchema>;
export type RubricCriteria = z.infer<typeof rubricCriteriaSchema>;

/** Structural parse of rubrics.criteria jsonb. */
export function parseRubricCriteria(input: unknown): RubricCriteria {
  return rubricCriteriaSchema.parse(input);
}

export function safeParseRubricCriteria(input: unknown) {
  return rubricCriteriaSchema.safeParse(input);
}

/** True when every cell has non-empty descriptor text (ready for grading prompts). */
export function isRubricCriteriaComplete(criteria: RubricCriteria): boolean {
  return criteria.cells.every((c) => c.description.trim().length > 0);
}

/**
 * Build an empty hybrid grid for N score levels (default 4→1).
 * UI can fill descriptions by copy/paste; weights stay null until set.
 */
export function emptyRubricCriteria(options?: {
  levelCount?: number;
  categoryNames?: string[];
}): RubricCriteria {
  const levelCount = options?.levelCount ?? 4;
  const categoryNames = options?.categoryNames ?? ["Category 1"];

  const levels: RubricLevel[] = [];
  for (let i = 0; i < levelCount; i++) {
    const score = levelCount - i;
    levels.push({
      id: `level-${score}`,
      score,
      label: "",
    });
  }

  const categories: RubricCategory[] = categoryNames.map((name, index) => ({
    id: `category-${index + 1}`,
    name,
    weight: null,
  }));

  const cells: RubricCell[] = [];
  for (const category of categories) {
    for (const level of levels) {
      cells.push({
        categoryId: category.id,
        levelId: level.id,
        description: "",
      });
    }
  }

  const scores = levels.map((l) => l.score);
  return {
    version: 1,
    scale: {
      min: Math.min(...scores),
      max: Math.max(...scores),
      percentMin: null,
      percentMax: null,
    },
    levels,
    categories,
    cells,
  };
}

/**
 * Pilot / calibration fixture matching the classwork-homework rubric PNG.
 * Not auto-seeded into the DB — teachers still enter their own copy.
 */
export function classworkHomeworkCriteriaFixture(): RubricCriteria {
  return {
    version: 1,
    scale: { min: 1, max: 4, percentMin: null, percentMax: null },
    levels: [
      { id: "level-4", score: 4, label: "Exceeds Standards" },
      { id: "level-3", score: 3, label: "Meets Standards" },
      { id: "level-2", score: 2, label: "Approaching Standard" },
      { id: "level-1", score: 1, label: "Does not meet Standard" },
    ],
    categories: [
      { id: "completeness", name: "Completeness", weight: null },
      { id: "understanding", name: "Understanding", weight: null },
      { id: "mechanics", name: "Mechanics / spelling", weight: null },
    ],
    cells: [
      {
        categoryId: "completeness",
        levelId: "level-4",
        description:
          "Student has completed the task thoroughly, and accurately.",
      },
      {
        categoryId: "completeness",
        levelId: "level-3",
        description: "Student completed the task.",
      },
      {
        categoryId: "completeness",
        levelId: "level-2",
        description: "Student completed some of the task.",
      },
      {
        categoryId: "completeness",
        levelId: "level-1",
        description: "Work is incomplete.",
      },
      {
        categoryId: "understanding",
        levelId: "level-4",
        description:
          "Students display an understanding of all key concepts and ideas associated with the task.",
      },
      {
        categoryId: "understanding",
        levelId: "level-3",
        description:
          "Students display an understanding of most key concepts and ideas associated with the task.",
      },
      {
        categoryId: "understanding",
        levelId: "level-2",
        description:
          "Student displays a vague understanding of the key concepts and ideas associated with the task.",
      },
      {
        categoryId: "understanding",
        levelId: "level-1",
        description:
          "There is no evidence of understanding key concepts or ideas associated with the task.",
      },
      {
        categoryId: "mechanics",
        levelId: "level-4",
        description: "Minimal amount of spelling and mechanical errors.",
      },
      {
        categoryId: "mechanics",
        levelId: "level-3",
        description: "Minimal amount of spelling and mechanical errors.",
      },
      {
        categoryId: "mechanics",
        levelId: "level-2",
        description: "Many mechanical and spelling errors.",
      },
      {
        categoryId: "mechanics",
        levelId: "level-1",
        description: "Too many mechanical and spelling errors.",
      },
    ],
  };
}

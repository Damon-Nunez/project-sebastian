import { z } from "zod";
import type { LessonPlanContent } from "./content";
import { imageSectionOptionsForContent } from "./imageSections";

/**
 * Optional discussion routines for a lesson draft.
 * Stored in lesson_plans.optional_routines (jsonb). Unused drafts keep {}.
 *
 * Teachers can configure multiple Turn and Talk / Think-Pair-Share blocks,
 * then Apply them into section bodies locally (no polish required).
 */

export const ROUTINE_KINDS = ["turnAndTalk", "thinkPairShare"] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

export const ROUTINE_PLACEMENTS = ["append", "weave"] as const;
export type RoutinePlacement = (typeof ROUTINE_PLACEMENTS)[number];

const routinePlacementSchema = z.enum(ROUTINE_PLACEMENTS);

export const routineBlockSchema = z.object({
  id: z.string().min(1),
  targetSectionKey: z.string().min(1),
  placement: routinePlacementSchema,
  prompts: z.string().default(""),
  /** Exact script last written into a section body (for replace-on-reapply). */
  lastAppliedText: z.string().optional(),
  /** Section key where lastAppliedText was written. */
  lastAppliedSectionKey: z.string().optional(),
});

export type RoutineBlock = z.infer<typeof routineBlockSchema>;

const routineBlocksSchema = z.array(routineBlockSchema).max(12);

export const optionalRoutinesSchema = z.object({
  turnAndTalk: routineBlocksSchema.default([]),
  thinkPairShare: routineBlocksSchema.default([]),
});

export type OptionalRoutines = z.infer<typeof optionalRoutinesSchema>;

export const ROUTINE_KIND_LABEL: Record<RoutineKind, string> = {
  turnAndTalk: "Turn and Talk",
  thinkPairShare: "Think-Pair-Share",
};

export const ROUTINE_HEADING: Record<RoutineKind, string> = {
  turnAndTalk: "TURN AND TALK",
  thinkPairShare: "THINK-PAIR-SHARE",
};

export function emptyOptionalRoutines(): OptionalRoutines {
  return { turnAndTalk: [], thinkPairShare: [] };
}

export function newRoutineBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `routine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createRoutineBlock(
  targetSectionKey: string,
  placement: RoutinePlacement = "append",
): RoutineBlock {
  return {
    id: newRoutineBlockId(),
    targetSectionKey,
    placement,
    prompts: "",
  };
}

/** Coerce legacy single-object turnAndTalk into a one-item array. */
function coerceLegacyBlocks(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const obj = raw as Record<string, unknown>;
  const next = { ...obj };

  for (const key of ROUTINE_KINDS) {
    const value = obj[key];
    if (value == null) {
      next[key] = [];
      continue;
    }
    if (Array.isArray(value)) continue;
    if (typeof value === "object") {
      const legacy = value as Record<string, unknown>;
      next[key] = [
        {
          id:
            typeof legacy.id === "string" && legacy.id.length > 0
              ? legacy.id
              : newRoutineBlockId(),
          targetSectionKey:
            typeof legacy.targetSectionKey === "string" &&
            legacy.targetSectionKey.length > 0
              ? legacy.targetSectionKey
              : key === "thinkPairShare"
                ? "workTime:A"
                : "opening",
          placement:
            legacy.placement === "weave" || legacy.placement === "append"
              ? legacy.placement
              : "append",
          prompts: typeof legacy.prompts === "string" ? legacy.prompts : "",
        },
      ];
    }
  }

  return next;
}

export function parseOptionalRoutines(raw: unknown): OptionalRoutines {
  if (
    raw == null ||
    (typeof raw === "object" && Object.keys(raw as object).length === 0)
  ) {
    return emptyOptionalRoutines();
  }
  return optionalRoutinesSchema.parse(coerceLegacyBlocks(raw));
}

export function safeParseOptionalRoutines(raw: unknown) {
  return optionalRoutinesSchema.safeParse(coerceLegacyBlocks(raw ?? {}));
}

export function pruneOptionalRoutines(
  routines: OptionalRoutines,
): OptionalRoutines {
  const pruneList = (blocks: RoutineBlock[]): RoutineBlock[] =>
    blocks.map((block) => ({
      id: block.id,
      targetSectionKey: block.targetSectionKey.trim() || "opening",
      placement: block.placement,
      prompts: block.prompts,
      ...(block.lastAppliedText
        ? { lastAppliedText: block.lastAppliedText }
        : {}),
      ...(block.lastAppliedSectionKey
        ? { lastAppliedSectionKey: block.lastAppliedSectionKey }
        : {}),
    }));

  const turnAndTalk = pruneList(routines.turnAndTalk ?? []);
  const thinkPairShare = pruneList(routines.thinkPairShare ?? []);

  if (turnAndTalk.length === 0 && thinkPairShare.length === 0) {
    return emptyOptionalRoutines();
  }

  return { turnAndTalk, thinkPairShare };
}

export function hasOptionalRoutineBlocks(routines: OptionalRoutines): boolean {
  return (
    (routines.turnAndTalk?.length ?? 0) > 0 ||
    (routines.thinkPairShare?.length ?? 0) > 0
  );
}

/** Instructional targets only (Opening / Work Times / Closing). */
export function routineTargetOptions(
  content: LessonPlanContent,
): { key: string; label: string }[] {
  return imageSectionOptionsForContent(content).filter(
    (opt) =>
      opt.key === "opening" ||
      opt.key === "closing" ||
      opt.key.startsWith("workTime:"),
  );
}

export function resolveTargetLabel(
  content: LessonPlanContent,
  targetSectionKey: string,
): string {
  const match = routineTargetOptions(content).find(
    (opt) => opt.key === targetSectionKey,
  );
  return match?.label ?? targetSectionKey;
}

/** Format one routine as classroom plan text (teacher prompts preserved). */
export function formatRoutineScript(
  kind: RoutineKind,
  block: RoutineBlock,
): string {
  const prompts = block.prompts.trim();
  const questions = prompts.length > 0 ? prompts : "(Add discussion questions)";
  return [ROUTINE_HEADING[kind], "QUESTIONS", questions].join("\n");
}

function removeScriptFromBody(body: string, script: string): string {
  if (!script || !body.includes(script)) return body;
  return body.replace(script, "").replace(/\n{3,}/g, "\n\n").trim();
}

function insertRoutineIntoBody(
  body: string,
  script: string,
  placement: RoutinePlacement,
): string {
  const trimmed = body.trim();
  if (!trimmed) return script;

  if (placement === "append") {
    return `${trimmed}\n\n${script}`;
  }

  // Weave: after the first paragraph / blank-line chunk.
  const parts = trimmed.split(/\n\s*\n/);
  if (parts.length <= 1) {
    return `${trimmed}\n\n${script}`;
  }
  const [first, ...rest] = parts;
  return [first, script, ...rest].join("\n\n");
}

/** All instructional section keys that can currently hold routine text. */
function instructionalSectionKeys(content: LessonPlanContent): string[] {
  return [
    "opening",
    ...content.workTimes.map((wt) => `workTime:${wt.key}`),
    "closing",
  ];
}

/**
 * Strip a previously applied script from wherever it still lives
 * (handles target changes and polish rewrites that leave orphans).
 */
function stripPreviousApplication(
  content: LessonPlanContent,
  block: RoutineBlock,
): LessonPlanContent {
  const previous = block.lastAppliedText?.trim();
  if (!previous) return content;

  let next = content;
  const preferred = block.lastAppliedSectionKey;
  const keys = preferred
    ? [preferred, ...instructionalSectionKeys(content).filter((k) => k !== preferred)]
    : instructionalSectionKeys(content);

  for (const key of keys) {
    const body = readSectionBody(next, key);
    if (body == null || !body.includes(previous)) continue;
    next = writeSectionBody(next, key, removeScriptFromBody(body, previous));
  }
  return next;
}

function readSectionBody(
  content: LessonPlanContent,
  sectionKey: string,
): string | null {
  if (sectionKey === "opening") return content.opening.body;
  if (sectionKey === "closing") return content.closing.body;
  if (sectionKey.startsWith("workTime:")) {
    const key = sectionKey.slice("workTime:".length);
    const block = content.workTimes.find((wt) => wt.key === key);
    return block ? block.body : null;
  }
  return null;
}

function writeSectionBody(
  content: LessonPlanContent,
  sectionKey: string,
  body: string,
): LessonPlanContent {
  if (sectionKey === "opening") {
    return {
      ...content,
      opening: { ...content.opening, body },
    };
  }
  if (sectionKey === "closing") {
    return {
      ...content,
      closing: { ...content.closing, body },
    };
  }
  if (sectionKey.startsWith("workTime:")) {
    const key = sectionKey.slice("workTime:".length);
    return {
      ...content,
      workTimes: content.workTimes.map((wt) =>
        wt.key === key ? { ...wt, body } : wt,
      ),
    };
  }
  return content;
}

export type ApplyRoutinesResult = {
  content: LessonPlanContent;
  routines: OptionalRoutines;
  appliedCount: number;
  skippedEmpty: number;
  skippedInvalidTarget: number;
};

/**
 * Deterministically insert configured routine blocks into section bodies.
 * Re-applying strips the previous script (even if the target section changed).
 */
export function applyOptionalRoutinesToContent(
  content: LessonPlanContent,
  routines: OptionalRoutines,
): ApplyRoutinesResult {
  let next = content;
  let appliedCount = 0;
  let skippedEmpty = 0;
  let skippedInvalidTarget = 0;

  const nextTurnAndTalk = [...(routines.turnAndTalk ?? [])];
  const nextThinkPairShare = [...(routines.thinkPairShare ?? [])];

  const jobs: {
    kind: RoutineKind;
    index: number;
    block: RoutineBlock;
  }[] = [
    ...nextTurnAndTalk.map((block, index) => ({
      kind: "turnAndTalk" as const,
      index,
      block,
    })),
    ...nextThinkPairShare.map((block, index) => ({
      kind: "thinkPairShare" as const,
      index,
      block,
    })),
  ];

  for (const { kind, index, block } of jobs) {
    if (!block.prompts.trim()) {
      skippedEmpty += 1;
      continue;
    }

    next = stripPreviousApplication(next, block);

    const current = readSectionBody(next, block.targetSectionKey);
    if (current == null) {
      skippedInvalidTarget += 1;
      const cleared: RoutineBlock = {
        ...block,
        lastAppliedText: undefined,
        lastAppliedSectionKey: undefined,
      };
      if (kind === "turnAndTalk") {
        nextTurnAndTalk[index] = cleared;
      } else {
        nextThinkPairShare[index] = cleared;
      }
      continue;
    }

    const script = formatRoutineScript(kind, block);
    const updated = insertRoutineIntoBody(current, script, block.placement);
    next = writeSectionBody(next, block.targetSectionKey, updated);
    const withApplied: RoutineBlock = {
      ...block,
      lastAppliedText: script,
      lastAppliedSectionKey: block.targetSectionKey,
    };
    if (kind === "turnAndTalk") {
      nextTurnAndTalk[index] = withApplied;
    } else {
      nextThinkPairShare[index] = withApplied;
    }
    appliedCount += 1;
  }

  return {
    content: next,
    routines: {
      turnAndTalk: nextTurnAndTalk,
      thinkPairShare: nextThinkPairShare,
    },
    appliedCount,
    skippedEmpty,
    skippedInvalidTarget,
  };
}

/**
 * Compact routine instructions for polish LLM (optional backup path).
 */
export function formatOptionalRoutinesContext(
  routines: OptionalRoutines,
  content: LessonPlanContent,
): string {
  const lines: string[] = [];

  function appendKind(kind: RoutineKind, blocks: RoutineBlock[]) {
    const usable = blocks.filter((b) => b.prompts.trim().length > 0);
    if (usable.length === 0) return;
    lines.push(
      `${ROUTINE_KIND_LABEL[kind]} optional blocks (${usable.length}) — honor these; do not invent extra questions:`,
    );
    usable.forEach((block, index) => {
      const label = resolveTargetLabel(content, block.targetSectionKey);
      const placement =
        block.placement === "weave"
          ? `WEAVE into "${label}"`
          : `APPEND under "${label}"`;
      lines.push(
        `  ${index + 1}. target=${block.targetSectionKey}; ${placement}`,
        `     prompts:\n${block.prompts.trim()}`,
      );
    });
  }

  appendKind("turnAndTalk", routines.turnAndTalk ?? []);
  appendKind("thinkPairShare", routines.thinkPairShare ?? []);

  return lines.join("\n");
}

/** @deprecated Use formatOptionalRoutinesContext */
export const formatTurnAndTalkContext = formatOptionalRoutinesContext;

/** @deprecated Use routineTargetOptions */
export const turnAndTalkTargetOptions = routineTargetOptions;

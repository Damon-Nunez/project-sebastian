import { DEFAULT_AI_MODEL } from "@/lib/ai/getAiClient";
import { createAiMessage } from "@/lib/ai/createAiMessage";
import {
  extractJsonObject,
  messageText,
} from "@/lib/ai/parseLlmJson";
import { prepareTextForAi } from "@/lib/sanitizer/prepareAiText";
import { rehydrate } from "@/lib/sanitizer";
import type { RosterStudent } from "@/lib/sanitizer/types";
import type { LessonPlanContent } from "./content";
import type { OptionalRoutines } from "./optionalRoutines";
import {
  emptyOptionalRoutines,
  formatOptionalRoutinesContext,
} from "./optionalRoutines";
import type { SectionGroupsMap } from "./sectionGroups";
import {
  applyPolishFields,
  extractPolishFields,
  formatGroupsContext,
  POLISH_FIELDS_JSON_SHAPE,
  polishFieldsSchema,
  rehydratePolishFields,
  type PolishFields,
} from "./polishPayload";

/**
 * Sonnet for final voice — closer to filled-in teacher plans than a cheap sort model.
 * Override via input.model when needed.
 */
export const LESSON_POLISH_MODEL = DEFAULT_AI_MODEL;

const SYSTEM_PROMPT = `You are the final polish middleman for a middle-school teacher's lesson plan draft in Sebastian.

Your job: rewrite the EDITABLE text fields so the plan reads like a filled-in teacher plan (not a Kiddom/EL export dump), while preserving the teacher's intent.

Voice & shape (match filled-in classroom plans):
- Practical, scannable classroom voice: what the teacher does, what students do, questions to ask.
- Prefer short must-do steps and facilitation scripts over long Teaching Notes / differentiation essays.
- Use familiar routines when they already fit the draft: Think-Pair-Share, Turn and Talk, repeated entrance/closing routines, ICT co-teaching notes when present.
- Keep timing collapsed and useful (Opening / Work Time A–… / Closing). Do not invent minutes; keep existing minutes unless the draft already states a clear correction.
- Standards: keep codes / short focus lines — do not paste long standard prose.
- Vocabulary: readable lines (term — gloss), bullet-friendly.
- Entrance ticket: student-facing prompt only.
- Preserve YouTube/resource URLs and any http(s) links already in the text.

Hard rules:
- Do NOT invent new activities, standards, materials, or homework that are not implied by the draft or the teacher's free-text asks.
- Do NOT remove Work Time blocks or change workTimes[].key values. Same keys, same count/order.
- Do NOT invent new extras entries; polish existing extras in place (same count/order).
- Honor free-text asks when they clarify how to phrase or emphasize something.
- Groupings context is optional background — do not dump student lists into the plan body.
- When Turn and Talk / Think-Pair-Share optional prompts are provided, prefer keeping any already-applied routine scripts in the section bodies. If prompts are only in the optional context and not yet in the bodies, insert them into the named target sections using the requested placement (append vs weave). Do not invent extra questions beyond the teacher's prompts. Do not create new top-level sections — keep routines inside section body text.
- Return ONLY valid JSON matching this shape (no markdown fences, no commentary):
${POLISH_FIELDS_JSON_SHAPE}`;


/** Ensure the model cannot drop/reorder Work Time keys. */
export function assertWorkTimeKeysPreserved(
  before: PolishFields,
  after: PolishFields,
): void {
  const beforeKeys = before.workTimes.map((block) => block.key);
  const afterKeys = after.workTimes.map((block) => block.key);
  if (
    beforeKeys.length !== afterKeys.length ||
    beforeKeys.some((key, index) => afterKeys[index] !== key)
  ) {
    throw new Error("LLM lesson polish changed Work Time keys or count");
  }
}

export type PolishLessonPlanWithLlmResult = {
  content: LessonPlanContent;
  model: string;
  inputChars: number;
  rawResponse: string;
};

/**
 * Sanitize → Sonnet polish → rehydrate → merge into LessonPlanContent.
 * Leaves images, links, bodyOriginal, and bodySimplified untouched.
 */
export async function polishLessonPlanWithLlm(input: {
  content: LessonPlanContent;
  teacherId: string;
  roster: RosterStudent[];
  freeTextAsks?: string | null;
  sectionGroups?: SectionGroupsMap;
  optionalRoutines?: OptionalRoutines;
  moduleLabel?: string | null;
  unitLabel?: string | null;
  lessonLabel?: string | null;
  model?: string;
}): Promise<PolishLessonPlanWithLlmResult> {
  const fields = extractPolishFields(input.content);
  const groupsContext = formatGroupsContext(input.sectionGroups ?? {});
  const turnAndTalkContext = formatOptionalRoutinesContext(
    input.optionalRoutines ?? emptyOptionalRoutines(),
    input.content,
  );
  const freeText = (input.freeTextAsks ?? "").trim();
  const model = input.model ?? LESSON_POLISH_MODEL;

  const labelLine = [
    input.moduleLabel ? `Module ${input.moduleLabel}` : null,
    input.unitLabel ? `Unit ${input.unitLabel}` : null,
    input.lessonLabel ? `Lesson ${input.lessonLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const userPrompt = [
    labelLine ? `Plan labels: ${labelLine}` : null,
    freeText ? `Teacher free-text asks (honor these):\n${freeText}` : null,
    groupsContext
      ? `Groupings context (do not invent student names in bodies):\n${groupsContext}`
      : null,
    turnAndTalkContext || null,
    "Polish the following lesson plan JSON. Return the same JSON shape.",
    "",
    "---LESSON PLAN JSON---",
    JSON.stringify(fields),
    "---END LESSON PLAN JSON---",
  ]
    .filter(Boolean)
    .join("\n\n");

  const prepared = prepareTextForAi(userPrompt, input.roster);

  const message = await createAiMessage(input.teacherId, prepared, {
    system: SYSTEM_PROMPT,
    model,
    maxTokens: 8192,
  });

  const rawResponse = messageText(
    message.content as { type: string; text?: string }[],
  );
  const parsed = extractJsonObject(rawResponse);
  const polishedRaw = polishFieldsSchema.parse(parsed);
  assertWorkTimeKeysPreserved(fields, polishedRaw);

  const polished = rehydratePolishFields(polishedRaw, (text) =>
    rehydrate(text, prepared.map),
  );

  return {
    content: applyPolishFields(input.content, polished),
    model,
    inputChars: userPrompt.length,
    rawResponse,
  };
}

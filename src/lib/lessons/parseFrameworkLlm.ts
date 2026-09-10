import { createAiMessage } from "@/lib/ai/createAiMessage";
import { prepareTextForAi } from "@/lib/sanitizer/prepareAiText";
import {
  FRAMEWORK_LLM_JSON_SHAPE,
  frameworkLlmBucketsSchema,
  type FrameworkLlmBuckets,
} from "./llmBuckets";

/** Cheap model dedicated to framework bucket sorting (not lesson generation). */
export const FRAMEWORK_PARSE_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You sort district lesson-framework text into fixed JSON buckets for a teacher lesson-plan form.

Rules:
- Extract and sort only. Do not invent teaching tips that are not in the text. Light cleanup for readability is OK (grammar, line breaks, bullets).
- If a bucket has no clear source text, use "" or [] or null as appropriate.
- agenda: short timed outline only (Opening / Work Time / Closing lines with minutes). Stop before Teaching Notes, Purpose, Support All Students, In advance, worksheets, or homework bodies.
- homework: homework assignments only — never put homework inside agenda.
- opening / closing:
  - body = full instructional extract for that segment (Opening A/B, Closing and Assessment, Exit Ticket facilitation). Prefer real segment text over agenda one-liners. Set minutes from the agenda when present.
  - bodySimplified = a shorter teacher-facing version of the SAME segment: core moves she should do + questions to ask students. Drop Kiddom fluff, long teaching notes, differentiation essays, and export noise. Practical classroom voice (like a filled-in teacher plan). If body is already short, set bodySimplified equal to body.
- entranceTicket: the student-facing Entrance Ticket prompt/question(s) from the framework (e.g. "QUESTION 1 …"). Include the question text students answer as they enter. Do NOT omit this when an Entrance Ticket section exists. Skip long "Note for Evaluating Responses" answer keys when possible.
- vocabulary: one vocabulary item per line as "term — short gloss" when glosses exist. Use clear readable wording. Prefer bullet-ready lines (we will prefix •). Do not dump a single run-on comma sentence when you can list items.
- learningTargets: the "I can…" targets only.
- materials: materials lists if present; otherwise "".
- standardsCodes: codes only (e.g. 8R6, RL.8.1, RST3). No prose descriptions.
- workTimes: one object per Work Time block (A, B, C…). Include short title, minutes from the agenda, AND:
  - title = short topic only (e.g. "Language Dive: …"). Do NOT repeat "Work Time A" / "Work Time B" in the title — the app adds that prefix.
  - body = FULL instructional extract for that Work Time (the long source text). Do not put the condensed version in body.
  - bodySimplified = condensed teacher-facing version: must-do steps + questions to ask; drop fluff. Must be shorter than body when body is long.
  Merge Ongoing Assessment lines that belong to the same lettered Work Time into that block's title or body when helpful.
- Ignore export noise: slide presentations, page numbers, and generic rubric tables (the app injects a standard rubric separately).
- Return ONLY valid JSON matching this shape (no markdown fences, no commentary):
${FRAMEWORK_LLM_JSON_SHAPE}`;

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const body = fence?.[1]?.trim() ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("LLM framework parse returned no JSON object");
  }
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

function messageText(
  content: { type: string; text?: string }[],
): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("\n");
}

export type ParseFrameworkWithLlmResult = {
  buckets: FrameworkLlmBuckets;
  model: string;
  inputChars: number;
  rawResponse: string;
};

/**
 * Schema-constrained LLM sort of extracted framework text into formula buckets.
 * Uses empty roster sanitizer seam (framework docs are not student submissions).
 */
export async function parseFrameworkWithLlm(input: {
  text: string;
  teacherId?: string;
  filename?: string;
  model?: string;
}): Promise<ParseFrameworkWithLlmResult> {
  const text = input.text.trim();
  if (!text) {
    throw new Error("Cannot LLM-parse empty framework text");
  }

  const model = input.model ?? FRAMEWORK_PARSE_MODEL;
  const teacherId = input.teacherId ?? "framework-parse-trial";
  const prepared = prepareTextForAi(text, []);

  const userPrompt = [
    input.filename ? `Source filename: ${input.filename}` : null,
    "Sort the following extracted framework text into the JSON buckets.",
    "",
    "---FRAMEWORK TEXT---",
    prepared.sanitizedText,
    "---END FRAMEWORK TEXT---",
  ]
    .filter(Boolean)
    .join("\n");

  // Re-prepare after wrapping so createAiMessage still receives PreparedAiText.
  const preparedWrapped = prepareTextForAi(userPrompt, []);

  const message = await createAiMessage(teacherId, preparedWrapped, {
    system: SYSTEM_PROMPT,
    model,
    maxTokens: 8192,
  });

  const rawResponse = messageText(
    message.content as { type: string; text?: string }[],
  );
  const parsed = extractJsonObject(rawResponse);
  const buckets = frameworkLlmBucketsSchema.parse(parsed);

  return {
    buckets,
    model,
    inputChars: text.length,
    rawResponse,
  };
}

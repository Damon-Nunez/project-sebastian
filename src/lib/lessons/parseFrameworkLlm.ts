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
- Extract and sort only. Do not invent, rewrite in a new voice, or add teaching tips that are not in the text.
- If a bucket has no clear source text, use "" or [] or null as appropriate.
- agenda: short timed outline only (Opening / Work Time / Closing lines with minutes). Stop before Teaching Notes, Purpose, Support All Students, In advance, worksheets, or homework bodies.
- homework: homework assignments only — never put homework inside agenda.
- opening / closing: instructional body for those segments (Opening A/B, Closing and Assessment, Exit Ticket directions). Prefer the real lesson segment text over agenda one-liners.
- learningTargets: the "I can…" targets only.
- materials: materials lists if present; otherwise "".
- standardsCodes: codes only (e.g. 8R6, RL.8.1, RST3). No prose descriptions.
- suggestedWorkTimeCount: how many Work Time blocks the source outlines (A/B/C…).
- workTimeTitles: short titles for each Work Time (no full instructional bodies — teacher owns those).
- Ignore export noise: presentations, full entrance/exit ticket worksheets, page numbers, rubric tables unless they are the only standards codes.
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

  const rawResponse = messageText(message.content as { type: string; text?: string }[]);
  const parsed = extractJsonObject(rawResponse);
  const buckets = frameworkLlmBucketsSchema.parse(parsed);

  return {
    buckets,
    model,
    inputChars: text.length,
    rawResponse,
  };
}

/**
 * One-time Claude vision pass: photo answer key → structured text for the
 * reference box (Ticket 11). Answer keys are teacher-owned (no roster masking).
 */
import {
  createAiTeacherVisionMessage,
  type TeacherAssetImage,
} from "@/lib/ai/createAiMessage";
import { DEFAULT_AI_MODEL } from "@/lib/ai/getAiClient";
import { messageText } from "@/lib/ai/parseLlmJson";
import { prepareTextForAi } from "@/lib/sanitizer";
import {
  MAX_REFERENCE_CHARS,
  normalizeReferenceText,
} from "./reference";

const SYSTEM = `You turn teacher answer-key page images into a clean structured answer key for grading.
Return ONLY plain text (no markdown fences, no commentary).
Rules:
- Multiple choice / bubbles / checkmarks: one line per item as "N. X" (e.g. 1. A).
- Short answer: "N. Q: <short question> / A: <correct answer>".
- Visual / diagram / box items: "N. Visual: <what the ideal filled answer looks like>".
- Preserve item order across pages.
- Prefer the filled/correct marks on the key; ignore decorative headers when possible.
- If a mark is unclear, write "N. ? (unclear on key)" rather than guessing.`;

const USER =
  "These page images are the teacher's answer key (in order). Extract the structured answer key now.";

export async function parseAnswerKeyFromImages(input: {
  teacherId: string;
  images: TeacherAssetImage[];
}): Promise<string> {
  if (input.images.length === 0) {
    throw new Error("No answer-key images to parse");
  }

  // Empty roster — answer keys must not carry student PII into this call.
  const prepared = prepareTextForAi(USER, []);
  const message = await createAiTeacherVisionMessage(
    input.teacherId,
    prepared,
    input.images,
    {
      system: SYSTEM,
      model: DEFAULT_AI_MODEL,
      maxTokens: 4096,
    },
  );

  const raw = messageText(message.content as { type: string; text?: string }[]);
  const text = normalizeReferenceText(
    raw.replace(/^```(?:text|markdown)?\s*/i, "").replace(/\s*```$/i, ""),
  );
  if (!text) {
    throw new Error("AI returned an empty answer key");
  }
  if (text.length > MAX_REFERENCE_CHARS) {
    return text.slice(0, MAX_REFERENCE_CHARS);
  }
  return text;
}

/**
 * One-time Claude vision pass: paper rubric photo → editor grid.
 * Rubrics are teacher-owned (no roster masking). Nothing is saved here.
 */
import {
  createAiTeacherVisionMessage,
  type TeacherAssetImage,
} from "@/lib/ai/createAiMessage";
import { DEFAULT_AI_MODEL } from "@/lib/ai/getAiClient";
import { extractJsonObject, messageText } from "@/lib/ai/parseLlmJson";
import { prepareTextForAi } from "@/lib/sanitizer";
import {
  RubricPhotoDraftError,
  rubricCriteriaFromPhotoDraft,
} from "./rubricPhotoDraft";
import type { RubricCriteria } from "./criteria";

const SYSTEM = `You read a teacher's paper rubric (photo or scan) and return JSON only.
Shape:
{
  "name": "short rubric name or empty string",
  "levels": [{ "score": 4, "label": "Exceeds" }],
  "categories": [
    {
      "name": "Content",
      "weight": null,
      "descriptors": { "4": "cell text", "3": "cell text", "2": "cell text", "1": "cell text" }
    }
  ]
}
Rules:
- scores are the printed point values (often 4, 3, 2, 1)
- descriptor keys are those scores as strings
- weight is a percent from 0 to 100, or null when the sheet has no weights
- preserve category order from the page
- do not invent categories that are not on the page
- if a cell is unreadable, use "(unclear on photo)" instead of guessing
- no markdown fences, no commentary`;

const USER =
  "These images are pages of one rubric, in order. Return the JSON now.";

export async function parseRubricPhotoFromImages(input: {
  teacherId: string;
  images: TeacherAssetImage[];
}): Promise<{ name: string | null; criteria: RubricCriteria }> {
  if (input.images.length === 0) {
    throw new RubricPhotoDraftError(
      "Couldn't read that rubric. Try a clearer photo, or type it in.",
    );
  }

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
  let json: unknown;
  try {
    json = extractJsonObject(raw);
  } catch {
    throw new RubricPhotoDraftError(
      "Couldn't read that rubric. Try a clearer photo, or type it in.",
    );
  }
  return rubricCriteriaFromPhotoDraft(json);
}

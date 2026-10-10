/**
 * Shared helpers for parsing LLM text responses.
 * Used by parseFrameworkLlm and polishLessonPlanLlm.
 */
import { jsonrepair } from "jsonrepair";

/**
 * Strip optional markdown fences and extract the outermost JSON object
 * from a raw LLM response string.
 */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const body = fence?.[1]?.trim() ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("LLM response contained no JSON object");
  }
  const sliced = body.slice(start, end + 1);
  try {
    return JSON.parse(sliced) as unknown;
  } catch (firstError) {
    try {
      // Handles unescaped quotes in strings, trailing commas, smart quotes, etc.
      // Local only — no extra model tokens.
      return JSON.parse(jsonrepair(sliced)) as unknown;
    } catch {
      if (firstError instanceof SyntaxError) {
        const pos = Number(/position (\d+)/.exec(firstError.message)?.[1] ?? -1);
        if (pos >= 0) {
          const from = Math.max(0, pos - 60);
          const to = Math.min(sliced.length, pos + 60);
          console.error(
            "[parseLlmJson] bad JSON near",
            pos,
            JSON.stringify(sliced.slice(from, to)),
          );
        }
      }
      throw firstError;
    }
  }
}

/**
 * Flatten Anthropic message content blocks into a plain string.
 */
export function messageText(
  content: { type: string; text?: string }[],
): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("\n");
}

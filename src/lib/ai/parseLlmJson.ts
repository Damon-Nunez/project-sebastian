/**
 * Shared helpers for parsing LLM text responses.
 * Used by parseFrameworkLlm and polishLessonPlanLlm.
 */

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
  return JSON.parse(body.slice(start, end + 1)) as unknown;
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

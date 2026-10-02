import type Anthropic from "@anthropic-ai/sdk";
import type { MaskedPageImage } from "@/lib/grading/vision";
import type { PreparedAiText } from "@/lib/sanitizer";
import { DEFAULT_AI_MODEL, getAiClient } from "./getAiClient";

export type CreateAiMessageOptions = {
  /** Optional system prompt — keep free of student names (templates only). */
  system?: string;
  model?: string;
  maxTokens?: number;
};

/**
 * Fail-closed AI entry point for student/teacher prompt text.
 *
 * Requires `PreparedAiText` from `prepareTextForAi` so raw roster-bearing
 * strings cannot be passed as the user message by accident.
 */
export async function createAiMessage(
  teacherId: string,
  prepared: PreparedAiText,
  options: CreateAiMessageOptions = {},
): Promise<Anthropic.Messages.Message> {
  const client = getAiClient(teacherId);

  return client.messages.create({
    model: options.model ?? DEFAULT_AI_MODEL,
    max_tokens: options.maxTokens ?? 1024,
    ...(options.system ? { system: options.system } : {}),
    messages: [{ role: "user", content: prepared.sanitizedText }],
  });
}

/**
 * Fail-closed vision entry point: sanitized text plus page images that went
 * through name masking (`loadMaskedPages` is the only source of `MaskedPageImage`).
 */
export async function createAiVisionMessage(
  teacherId: string,
  prepared: PreparedAiText,
  pages: MaskedPageImage[],
  options: CreateAiMessageOptions = {},
): Promise<Anthropic.Messages.Message> {
  const client = getAiClient(teacherId);

  return client.messages.create({
    model: options.model ?? DEFAULT_AI_MODEL,
    max_tokens: options.maxTokens ?? 1024,
    ...(options.system ? { system: options.system } : {}),
    messages: [
      {
        role: "user",
        content: [
          ...pages.map((page) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: page.mediaType,
              data: page.base64,
            },
          })),
          { type: "text" as const, text: prepared.sanitizedText },
        ],
      },
    ],
  });
}

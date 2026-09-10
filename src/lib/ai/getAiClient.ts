import Anthropic from "@anthropic-ai/sdk";
import { requireAnthropicEnv } from "@/lib/env";

/** Default model for lesson drafts + grading suggestions (Ticket 0 lock: Sonnet). */
export const DEFAULT_AI_MODEL = "claude-sonnet-5";

/**
 * Option B AI access: low-level Anthropic client factory.
 * MVP: always uses the app key from ANTHROPIC_API_KEY.
 * Future: if the teacher has api_key_encrypted, use theirs; else app key + usage_tokens.
 *
 * Privacy: do **not** call `client.messages.create` with raw student-bearing
 * text. Use `prepareTextForAi` then `createAiMessage(teacherId, prepared, …)`
 * from `@/lib/ai/createAiMessage`. Health checks may call this for client init only.
 *
 * @param _teacherId Reserved for future per-teacher BYOK / usage tracking.
 */
export function getAiClient(_teacherId: string): Anthropic {
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv();

  return new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  });
}

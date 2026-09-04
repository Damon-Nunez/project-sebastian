import Anthropic from "@anthropic-ai/sdk";
import { requireAnthropicEnv } from "@/lib/env";

/** Default model for lesson drafts + grading suggestions (Ticket 0 lock). */
export const DEFAULT_AI_MODEL = "claude-sonnet-4-20250514";

/**
 * Option B AI access: feature code calls this instead of importing the SDK.
 * MVP: always uses the app key from ANTHROPIC_API_KEY.
 * Future: if the teacher has api_key_encrypted, use theirs; else app key + usage_tokens.
 *
 * @param _teacherId Reserved for future per-teacher BYOK / usage tracking.
 */
export function getAiClient(_teacherId: string): Anthropic {
  const { ANTHROPIC_API_KEY } = requireAnthropicEnv();

  return new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
  });
}

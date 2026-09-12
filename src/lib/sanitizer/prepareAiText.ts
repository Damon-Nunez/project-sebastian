import { buildNameTokenMap, redact, rehydrate } from "./redact";
import { assertSanitizedForAi } from "./verify";
import type { NameTokenMap, RosterStudent } from "./types";

export type PreparedAiText = {
  /** Safe to send to an external AI — roster names replaced with placeholders. */
  sanitizedText: string;
  /** Keep local; use rehydratePreparedAiText for teacher-facing display. */
  map: NameTokenMap;
};

/**
 * Mandatory seam before any external AI call (grading, lesson planning, etc.).
 *
 * Redacts roster names, then **verifies** none remain (fail closed).
 * Prefer `createAiMessage(teacherId, prepared, …)` over raw SDK calls.
 *
 * Timing: at Grade / Generate click — not at upload.
 */
export function prepareTextForAi(
  text: string,
  roster: RosterStudent[],
): PreparedAiText {
  const map = buildNameTokenMap(roster);
  const sanitizedText = redact(text, map);
  assertSanitizedForAi(sanitizedText, map);
  return { sanitizedText, map };
}

/** @deprecated Use `rehydrate` from @/lib/sanitizer directly. */
export function rehydratePreparedAiText(
  text: string,
  map: NameTokenMap,
): string {
  return rehydrate(text, map);
}

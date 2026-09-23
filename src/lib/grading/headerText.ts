/**
 * Helpers for student-work text used by local name match (Ticket 9.3).
 */

/** Leading snippet of body text for filename+header matching. */
export function headerTextForMatch(
  body: string,
  maxChars = 1500,
): string {
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars);
}

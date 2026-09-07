import { aliasPatternBody, normalizePersonName } from "./names";
import type { NameTokenMap } from "./types";

/** Thrown when sanitized text still contains roster name aliases. */
export class SanitizerVerificationError extends Error {
  readonly remainingAliases: string[];

  constructor(remainingAliases: string[]) {
    const unique = [...new Set(remainingAliases)];
    super(
      `Sanitizer verification failed; roster names still present: ${unique.join(", ")}`,
    );
    this.name = "SanitizerVerificationError";
    this.remainingAliases = unique;
  }
}

/**
 * Scan text for any roster aliases still present (same matching rules as redact).
 * Used as a fail-closed check after redaction.
 */
export function findRemainingRosterAliases(
  text: string,
  map: NameTokenMap,
): string[] {
  const found: string[] = [];

  for (const entry of map.entries) {
    for (const alias of entry.aliases) {
      const normalized = normalizePersonName(alias);
      const body = aliasPatternBody(normalized);
      if (!body) continue;

      const pattern = new RegExp(`(?<![\\p{L}])${body}(?![\\p{L}])`, "giu");
      if (pattern.test(text)) {
        found.push(normalized);
      }
    }
  }

  return [...new Set(found)];
}

/**
 * Fail closed: throw if any roster aliases remain in text that would go to AI.
 */
export function assertSanitizedForAi(text: string, map: NameTokenMap): void {
  const remaining = findRemainingRosterAliases(text, map);
  if (remaining.length > 0) {
    throw new SanitizerVerificationError(remaining);
  }
}

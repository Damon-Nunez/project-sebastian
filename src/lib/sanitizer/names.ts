/** Shared name normalization + variants for match and redact. */

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Trim, map NBSP → space, collapse internal whitespace. */
export function normalizePersonName(name: string): string {
  return name
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Full-name order variants used by both document match and redaction.
 * Roster "Maria Garcia" → also "Garcia Maria" and "Garcia, Maria".
 */
export function fullNameOrderVariants(fullName: string): string[] {
  const name = normalizePersonName(fullName);
  if (!name) return [];

  const parts = name.split(" ").filter(Boolean);
  const variants = new Set<string>([name]);

  if (parts.length >= 2) {
    const first = parts[0]!;
    const last = parts[parts.length - 1]!;
    variants.add(`${last} ${first}`);
    variants.add(`${last}, ${first}`);
  }

  return [...variants];
}

/**
 * Whole-variant match in already-normalized lowercase haystack.
 * Avoids substring false positives (Ann ⊄ Anna, Lee ⊄ sleeping).
 */
export function haystackHasNameVariant(
  haystackLower: string,
  variant: string,
): boolean {
  const normalized = normalizePersonName(variant).toLowerCase();
  if (!normalized || !haystackLower) return false;

  const escaped = escapeRegExp(normalized).replace(/\s+/g, "\\s+");
  const pattern = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "u");
  return pattern.test(haystackLower);
}

/**
 * Regex body for one alias: allow spaces or NBSP between name parts
 * so Word/PDF copy-paste doesn't bypass redaction.
 */
export function aliasPatternBody(alias: string): string {
  const normalized = normalizePersonName(alias);
  return normalized
    .split(" ")
    .filter(Boolean)
    .map(escapeRegExp)
    .join("[\\s\\u00A0]+");
}

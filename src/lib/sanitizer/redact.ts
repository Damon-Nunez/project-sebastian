import {
  aliasPatternBody,
  fullNameOrderVariants,
  isUsableAlias,
  normalizePersonName,
  STU_TOKEN_RE,
} from "./names";
import { assertSanitizedForAi } from "./verify";
import type { NameTokenEntry, NameTokenMap, RosterStudent } from "./types";

/** Stable placeholder tied to the student row id (not display-name order). */
export function tokenForStudentId(studentId: string): string {
  return `[[STU_${studentId}]]`;
}

/** Placeholder for a name part several students share; shown back as "[student]". */
export const SHARED_NAME_TOKEN = "[[STU_SHARED]]";
const SHARED_NAME_DISPLAY = "[student]";

function splitName(fullName: string): { first: string; last: string | null } {
  const parts = normalizePersonName(fullName).split(" ").filter(Boolean);
  if (parts.length === 0) return { first: "", last: null };
  if (parts.length === 1) return { first: parts[0]!, last: null };
  return { first: parts[0]!, last: parts[parts.length - 1]! };
}

/**
 * Replace only outside existing [[STU_…]] tokens so later aliases can't eat
 * hex letters inside student-id placeholders (e.g. alias "Be" vs uuid "…be…").
 */
function replaceOutsideStuTokens(
  text: string,
  pattern: RegExp,
  replacement: string,
): string {
  const tokenRe = new RegExp(STU_TOKEN_RE.source, STU_TOKEN_RE.flags);
  const chunks: string[] = [];
  let last = 0;
  for (const match of text.matchAll(tokenRe)) {
    const start = match.index ?? 0;
    chunks.push(text.slice(last, start).replace(pattern, replacement));
    chunks.push(match[0]!);
    last = start + match[0]!.length;
  }
  chunks.push(text.slice(last).replace(pattern, replacement));
  return chunks.join("");
}

/**
 * V1 edge-case policy for which strings feed the redact map:
 * - Always: full roster name + Last/First order variants (shared with match)
 * - First name: only if unique across the roster (case-insensitive)
 * - Last name: only if unique across the roster
 * - Nickname: only if unique among nicknames AND does not collide with another
 *   student's first/last (no invented dictionary)
 * - Duplicate full names: first student id (lexicographic) owns that alias
 * - Aliases shorter than MIN_ALIAS_CHARS are skipped (MC "A", UUID hex)
 * Shared parts left out here are still redacted, to SHARED_NAME_TOKEN.
 */
export function aliasesForRoster(roster: RosterStudent[]): Map<string, string[]> {
  const cleaned = roster
    .map((row) => ({
      id: row.id.trim(),
      name: normalizePersonName(row.name),
      nickname: normalizePersonName(row.nickname ?? ""),
    }))
    .filter((row) => row.id.length > 0 && row.name.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  const firstCounts = new Map<string, number>();
  const lastCounts = new Map<string, number>();
  const nicknameCounts = new Map<string, number>();

  for (const row of cleaned) {
    const { first, last } = splitName(row.name);
    firstCounts.set(
      first.toLowerCase(),
      (firstCounts.get(first.toLowerCase()) ?? 0) + 1,
    );
    if (last) {
      lastCounts.set(
        last.toLowerCase(),
        (lastCounts.get(last.toLowerCase()) ?? 0) + 1,
      );
    }
    if (row.nickname) {
      const key = row.nickname.toLowerCase();
      nicknameCounts.set(key, (nicknameCounts.get(key) ?? 0) + 1);
    }
  }

  const byId = new Map<string, string[]>();

  for (const row of cleaned) {
    const aliases = new Set<string>(
      fullNameOrderVariants(row.name).filter(isUsableAlias),
    );
    const { first, last } = splitName(row.name);

    if (
      first &&
      isUsableAlias(first) &&
      (firstCounts.get(first.toLowerCase()) ?? 0) === 1
    ) {
      aliases.add(first);
    }
    if (
      last &&
      isUsableAlias(last) &&
      (lastCounts.get(last.toLowerCase()) ?? 0) === 1
    ) {
      aliases.add(last);
    }
    if (
      row.nickname &&
      isUsableAlias(row.nickname) &&
      (nicknameCounts.get(row.nickname.toLowerCase()) ?? 0) === 1
    ) {
      const nickKey = row.nickname.toLowerCase();
      const collidesWithOtherName = cleaned.some((other) => {
        if (other.id === row.id) return false;
        const parts = splitName(other.name);
        return (
          parts.first.toLowerCase() === nickKey ||
          (parts.last !== null && parts.last.toLowerCase() === nickKey)
        );
      });
      if (!collidesWithOtherName) {
        aliases.add(row.nickname);
      }
    }

    byId.set(row.id, [...aliases]);
  }

  return byId;
}

/**
 * Build a redact/rehydrate map from the roster (identifiers → placeholders).
 * Duplicate display names: first student by id owns that full-name alias.
 */
export function buildNameTokenMap(roster: RosterStudent[]): NameTokenMap {
  const cleaned = roster
    .map((row) => ({
      id: row.id.trim(),
      name: normalizePersonName(row.name),
      nickname: normalizePersonName(row.nickname ?? "") || null,
    }))
    .filter((row) => row.id.length > 0 && row.name.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  const aliasById = aliasesForRoster(cleaned);

  const entries: NameTokenEntry[] = cleaned.map((row) => ({
    studentId: row.id,
    name: row.name,
    token: tokenForStudentId(row.id),
    aliases: aliasById.get(row.id) ?? [row.name].filter(isUsableAlias),
  }));

  const owned = new Set(
    entries.flatMap((entry) => entry.aliases.map((a) => a.toLowerCase())),
  );
  const shared = new Map<string, string>();
  for (const row of cleaned) {
    const { first, last } = splitName(row.name);
    for (const part of [first, last, row.nickname]) {
      if (part && isUsableAlias(part) && !owned.has(part.toLowerCase())) {
        shared.set(part.toLowerCase(), part);
      }
    }
  }

  return { entries, sharedAliases: [...shared.values()] };
}

type AliasHit = { alias: string; token: string; studentId: string };

/**
 * Flatten aliases for find-and-replace.
 * Same alias claimed by two students → lowest student id wins (V1).
 * Longest aliases first so "Maria Garcia" beats "Maria".
 */
function replacePlan(map: NameTokenMap): AliasHit[] {
  const byAlias = new Map<string, AliasHit>();

  for (const entry of map.entries) {
    for (const alias of entry.aliases) {
      if (!isUsableAlias(alias)) continue;
      const key = normalizePersonName(alias).toLowerCase();
      const existing = byAlias.get(key);
      if (!existing || entry.studentId.localeCompare(existing.studentId) < 0) {
        byAlias.set(key, {
          alias: normalizePersonName(alias),
          token: entry.token,
          studentId: entry.studentId,
        });
      }
    }
  }

  return [...byAlias.values()].sort(
    (a, b) =>
      b.alias.length - a.alias.length || a.studentId.localeCompare(b.studentId),
  );
}

/**
 * Replace roster name aliases in text with placeholders.
 * Case-insensitive; whole-name match; flexible spaces/NBSP between parts.
 * Run this immediately before any external AI call — not at upload time.
 */
export function redact(text: string, map: NameTokenMap): string {
  let result = text;

  const plan = [
    ...replacePlan(map),
    ...map.sharedAliases
      .filter(isUsableAlias)
      .map((alias) => ({ alias, token: SHARED_NAME_TOKEN })),
  ];
  for (const hit of plan) {
    const body = aliasPatternBody(hit.alias);
    if (!body) continue;

    const pattern = new RegExp(`(?<![\\p{L}])${body}(?![\\p{L}])`, "giu");
    result = replaceOutsideStuTokens(result, pattern, hit.token);
  }

  return result;
}

/**
 * Put real names back for teacher-facing display.
 * Longer tokens first so ids can't partially collide (they shouldn't, but safe).
 */
export function rehydrate(text: string, map: NameTokenMap): string {
  let result = text;

  const byTokenLength = [...map.entries].sort(
    (a, b) =>
      b.token.length - a.token.length || a.studentId.localeCompare(b.studentId),
  );

  for (const entry of byTokenLength) {
    result = result.split(entry.token).join(entry.name);
  }

  return result.split(SHARED_NAME_TOKEN).join(SHARED_NAME_DISPLAY);
}

/** Convenience: build map + redact + verify. Prefer prepareTextForAi at call sites. */
export function sanitizeForAi(
  text: string,
  roster: RosterStudent[],
): { text: string; map: NameTokenMap } {
  const map = buildNameTokenMap(roster);
  const sanitized = redact(text, map);
  assertSanitizedForAi(sanitized, map);
  return { text: sanitized, map };
}

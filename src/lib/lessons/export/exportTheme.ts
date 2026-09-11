/**
 * Shared default export theme for lesson plan PDF + DOCX.
 * Hierarchy only — no teacher-specific accent colors in V1.
 */

/** pdf-lib / CSS-ish pt sizes */
export const EXPORT_THEME = {
  titleSize: 20,
  subtitleSize: 11,
  sectionHeadingSize: 14,
  bodySize: 11,
  captionSize: 9,
  linkSize: 10,
  /** Extra gap after title block before first section */
  afterTitleGap: 10,
  afterSubtitleGap: 16,
  afterSectionHeadingGap: 8,
  afterBodyGap: 10,
  /** Extra vertical space for a blank line in the body (PDF). */
  blankLineExtra: 6,
} as const;

/** docx half-points (size * 2) */
export const EXPORT_THEME_DOCX = {
  titleSize: 40,
  subtitleSize: 22,
  sectionHeadingSize: 28,
  bodySize: 22,
  captionSize: 18,
  linkSize: 20,
  afterTitle: 200,
  afterSubtitle: 280,
  beforeSection: 320,
  afterSection: 140,
  /** Spacing after a normal body line */
  afterBodyLine: 80,
  /** Spacing after a blank line (preserves paragraph gaps) */
  afterBlankLine: 200,
  afterRoutineHeading: 60,
} as const;

export const EXPORT_COLORS = {
  text: { r: 0.1, g: 0.1, b: 0.12 },
  heading: { r: 0.08, g: 0.09, b: 0.12 },
  link: { r: 0.05, g: 0.35, b: 0.75 },
  /** DOCX hex without # */
  textHex: "1A1A1F",
  headingHex: "14151A",
  linkHex: "0563C1",
} as const;

/**
 * Known routine / label lines that should print bold in body text.
 * Match whole line (trimmed), case-insensitive.
 */
const ROUTINE_HEADING_EXACT = new Set([
  "TURN AND TALK",
  "THINK-PAIR-SHARE",
  "THINK PAIR SHARE",
  "THINK - PAIR - SHARE",
  "QUESTIONS",
  "QUESTION",
]);

const ROUTINE_HEADING_PREFIX =
  /^(TURN AND TALK|THINK[\s-]*PAIR[\s-]*SHARE|QUESTIONS?)\b/i;

export function isRoutineHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const normalized = trimmed.replace(/\s+/g, " ").toUpperCase();
  if (ROUTINE_HEADING_EXACT.has(normalized)) return true;
  // Also bold short label lines like "TURN AND TALK — Opening"
  if (ROUTINE_HEADING_PREFIX.test(trimmed) && trimmed.length <= 64) {
    return true;
  }
  return false;
}

/** Split body into lines, preserving empty lines for spacing. */
export function splitBodyLines(body: string): string[] {
  return body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

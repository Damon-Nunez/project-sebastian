/**
 * Which parts of a homework photo get blacked out before the AI sees it
 * (Ticket 10 / SCRUM-132). Pure — OCR and image drawing live in `vision.ts`.
 * Errs toward masking too much: every roster name part, not just unique ones.
 */

export type OcrWord = {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type MaskBox = { x: number; y: number; width: number; height: number };

/** Top of page 1 is always blacked out — names are written top-left or top-right. */
export const HEADER_STRIP_FRACTION = 0.15;

/** Roster words this long tolerate one OCR letter mistake. */
const FUZZY_MIN_LENGTH = 5;
const BOX_PADDING_PX = 6;
/** Width blacked out after a "Name" label, as a share of the page. */
const NAME_LINE_FRACTION = 0.45;

export function normalizeOcrWord(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]s$/u, "")
    .replace(/[^\p{L}]/gu, "");
}

/** Every first / middle / last / nickname part across all rosters. */
export function rosterMaskTokens(
  roster: Array<{ name: string; nickname?: string | null }>,
): Set<string> {
  const tokens = new Set<string>();
  for (const student of roster) {
    for (const part of `${student.name} ${student.nickname ?? ""}`.split(/[\s,-]+/)) {
      const token = normalizeOcrWord(part);
      if (token.length >= 2) tokens.add(token);
    }
  }
  return tokens;
}

export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function isRosterWord(word: string, tokens: ReadonlySet<string>): boolean {
  const normalized = normalizeOcrWord(word);
  if (normalized.length < 2) return false;
  if (tokens.has(normalized)) return true;
  if (normalized.length < FUZZY_MIN_LENGTH) return false;
  for (const token of tokens) {
    if (token.length >= FUZZY_MIN_LENGTH && withinOneEdit(normalized, token)) {
      return true;
    }
  }
  return false;
}

function clampBox(box: MaskBox, width: number, height: number): MaskBox | null {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const right = Math.min(width, Math.ceil(box.x + box.width));
  const bottom = Math.min(height, Math.ceil(box.y + box.height));
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

function padded(word: OcrWord): MaskBox {
  return {
    x: word.x0 - BOX_PADDING_PX,
    y: word.y0 - BOX_PADDING_PX,
    width: word.x1 - word.x0 + BOX_PADDING_PX * 2,
    height: word.y1 - word.y0 + BOX_PADDING_PX * 2,
  };
}

/** The handwritten part after "Name:" often isn't OCR'd, so cover the line itself. */
function nameLineBox(label: OcrWord, pageWidth: number): MaskBox {
  const lineHeight = label.y1 - label.y0;
  return {
    x: label.x0 - BOX_PADDING_PX,
    y: label.y0 - lineHeight * 0.75,
    width: label.x1 - label.x0 + pageWidth * NAME_LINE_FRACTION,
    height: lineHeight * 2.5,
  };
}

export type PageMask = {
  boxes: MaskBox[];
  /** Roster-name words + "Name" lines found on this page. */
  nameBoxes: number;
  headerStrip: boolean;
};

export function maskBoxesForPage(input: {
  words: OcrWord[];
  width: number;
  height: number;
  pageIndex: number;
  rosterTokens: ReadonlySet<string>;
}): PageMask {
  const raw: MaskBox[] = [];
  const headerStrip = input.pageIndex === 0;
  if (headerStrip) {
    raw.push({
      x: 0,
      y: 0,
      width: input.width,
      height: input.height * HEADER_STRIP_FRACTION,
    });
  }

  let nameBoxes = 0;
  for (const word of input.words) {
    if (normalizeOcrWord(word.text) === "name") {
      raw.push(nameLineBox(word, input.width));
      nameBoxes += 1;
    } else if (isRosterWord(word.text, input.rosterTokens)) {
      raw.push(padded(word));
      nameBoxes += 1;
    }
  }

  const boxes = raw
    .map((box) => clampBox(box, input.width, input.height))
    .filter((box): box is MaskBox => box !== null);
  return { boxes, nameBoxes, headerStrip };
}

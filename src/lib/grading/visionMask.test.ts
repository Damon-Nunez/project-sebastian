import { describe, expect, it } from "vitest";
import {
  HEADER_STRIP_FRACTION,
  isRosterWord,
  maskBoxesForPage,
  rosterMaskTokens,
  withinOneEdit,
  type OcrWord,
} from "./visionMask";

const tokens = rosterMaskTokens([
  { name: "Maria Elena Garcia", nickname: "Lena" },
  { name: "Damon Nunez", nickname: null },
  { name: "Maria Lopez", nickname: null },
]);

function word(text: string, x0: number, y0: number, x1 = x0 + 100, y1 = y0 + 30): OcrWord {
  return { text, x0, y0, x1, y1 };
}

describe("rosterMaskTokens", () => {
  it("keeps every name part, including shared first names and nicknames", () => {
    expect([...tokens].sort()).toEqual(
      ["damon", "elena", "garcia", "lena", "lopez", "maria", "nunez"].sort(),
    );
  });
});

describe("withinOneEdit", () => {
  it("allows one substitution, insertion or deletion", () => {
    expect(withinOneEdit("garcia", "garcia")).toBe(true);
    expect(withinOneEdit("garcia", "gareia")).toBe(true);
    expect(withinOneEdit("garcia", "garca")).toBe(true);
    expect(withinOneEdit("garcia", "garciaa")).toBe(true);
    expect(withinOneEdit("garcia", "gerica")).toBe(false);
  });
});

describe("isRosterWord", () => {
  it("matches case, punctuation, possessives and accents", () => {
    expect(isRosterWord("MARIA,", tokens)).toBe(true);
    expect(isRosterWord("Garcia's", tokens)).toBe(true);
    expect(isRosterWord("Nuñez", tokens)).toBe(true);
  });

  it("tolerates one OCR mistake only on longer words", () => {
    expect(isRosterWord("Garcla", tokens)).toBe(true);
    expect(isRosterWord("Damen", tokens)).toBe(true);
    expect(isRosterWord("Lens", tokens)).toBe(false);
  });

  it("leaves ordinary words alone", () => {
    expect(isRosterWord("house", tokens)).toBe(false);
    expect(isRosterWord("a", tokens)).toBe(false);
  });
});

describe("maskBoxesForPage", () => {
  const page = { width: 1000, height: 1400, rosterTokens: tokens };

  it("always blacks out the page-1 header strip, even with no OCR words", () => {
    const mask = maskBoxesForPage({ ...page, words: [], pageIndex: 0 });
    expect(mask.headerStrip).toBe(true);
    expect(mask.nameBoxes).toBe(0);
    expect(mask.boxes).toEqual([
      { x: 0, y: 0, width: 1000, height: 1400 * HEADER_STRIP_FRACTION },
    ]);
  });

  it("skips the strip on later pages but still masks roster names", () => {
    const mask = maskBoxesForPage({
      ...page,
      pageIndex: 1,
      words: [word("Esperanza", 50, 600), word("Garcia", 400, 900)],
    });
    expect(mask.headerStrip).toBe(false);
    expect(mask.nameBoxes).toBe(1);
    expect(mask.boxes).toEqual([{ x: 394, y: 894, width: 112, height: 42 }]);
  });

  it("covers the line after a Name label wherever it appears", () => {
    const mask = maskBoxesForPage({
      ...page,
      pageIndex: 1,
      words: [word("Name:", 600, 400, 680, 430)],
    });
    expect(mask.nameBoxes).toBe(1);
    const [box] = mask.boxes;
    expect(box!.x).toBe(594);
    expect(box!.x + box!.width).toBe(1000);
    expect(box!.y).toBeLessThan(400);
    expect(box!.y + box!.height).toBeGreaterThan(430);
  });
});

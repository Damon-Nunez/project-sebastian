import { Document, Packer, Paragraph, TextRun } from "docx";
import { describe, expect, it } from "vitest";
import { extractDocxMarkedText, markedTextFromHtml } from "./docxMarkedText";

describe("extractDocxMarkedText", () => {
  it("reads highlight and strikethrough from a real Word file", async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph("1. Why does Esperanza want to leave?"),
            new Paragraph("A) She likes the house"),
            new Paragraph({
              children: [
                new TextRun("B) "),
                new TextRun({ text: "She is ashamed of it", highlight: "yellow" }),
              ],
            }),
            new Paragraph({
              children: [new TextRun({ text: "C) She is moving away", strike: true })],
            }),
          ],
        },
      ],
    });
    const text = await extractDocxMarkedText(await Packer.toBuffer(doc));
    expect(text).toContain("B) [[hl]]She is ashamed of it[[/hl]]");
    expect(text).toContain("[[s]]C) She is moving away[[/s]]");
    expect(text).toContain("A) She likes the house");
  });
});

describe("markedTextFromHtml", () => {
  it("marks highlighted, bold, underlined and struck answer options", () => {
    const html =
      "<p>A) He stayed</p><p>B) <mark>He wanted to leave</mark></p>" +
      "<p>C) <s>He moved</s></p><p>D) <strong>He cried</strong> and <u>left</u></p>";
    expect(markedTextFromHtml(html)).toBe(
      [
        "A) He stayed",
        "B) [[hl]]He wanted to leave[[/hl]]",
        "C) [[s]]He moved[[/s]]",
        "D) [[b]]He cried[[/b]] and [[u]]left[[/u]]",
      ].join("\n"),
    );
  });

  it("restores Word list numbering, including nested lists", () => {
    const html =
      "<ol><li>Who is the narrator?<ol><li>Esperanza</li><li>Nenny</li></ol></li>" +
      "<li>Where do they live?</li></ol>";
    expect(markedTextFromHtml(html)).toBe(
      [
        "1. Who is the narrator?",
        "  1. Esperanza",
        "  2. Nenny",
        "2. Where do they live?",
      ].join("\n"),
    );
  });

  it("keeps table cells apart and decodes entities", () => {
    const html =
      "<table><tr><td><p>Word</p></td><td><p>Meaning</p></td></tr>" +
      "<tr><td><p>rickety</p></td><td><p>shaky &amp; weak &#8212; old</p></td></tr></table>";
    expect(markedTextFromHtml(html)).toContain("rickety");
    expect(markedTextFromHtml(html)).toContain("shaky & weak — old");
  });

  it("drops empty formatting runs", () => {
    expect(markedTextFromHtml("<p>Name: <strong></strong>Ana</p>")).toBe("Name: Ana");
  });
});

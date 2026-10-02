/**
 * .docx → text that keeps answer-marking formatting (Ticket 10 / SCRUM-130).
 * Students pick multiple-choice answers by highlighting, bolding, underlining
 * or striking out options; raw text extraction drops all of that.
 *
 * Markers are short ([[hl]] etc.) so they never count as content words in
 * the key-overlap check. Word list numbering is restored as "1." / "2.".
 */
import {
  EmptyFrameworkTextError,
  normalizeExtractedText,
} from "@/lib/lessons/extract";

const STYLE_MAP = ["highlight => mark", "u => u", "strike => s"];

const MARKERS: Record<string, string> = {
  mark: "hl",
  strong: "b",
  u: "u",
  s: "s",
};

const BLOCK_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "table",
]);

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1]?.toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Flatten mammoth's HTML output into marked plain text. */
export function markedTextFromHtml(html: string): string {
  const lists: Array<{ ordered: boolean; count: number }> = [];
  let out = "";
  const tokens = html.match(/<\/?[a-z0-9]+[^>]*>|[^<]+/gi) ?? [];

  for (const token of tokens) {
    const tag = token.match(/^<(\/?)([a-z0-9]+)/i);
    if (!tag) {
      out += decodeEntities(token);
      continue;
    }
    const closing = tag[1] === "/";
    const name = tag[2]!.toLowerCase();

    const marker = MARKERS[name];
    if (marker) {
      out += closing ? `[[/${marker}]]` : `[[${marker}]]`;
    } else if (name === "ol" || name === "ul") {
      if (closing) {
        lists.pop();
        if (lists.length === 0) out += "\n";
      } else {
        lists.push({ ordered: name === "ol", count: 0 });
      }
    } else if (name === "li" && !closing) {
      const list = lists[lists.length - 1];
      const indent = "  ".repeat(Math.max(0, lists.length - 1));
      if (list) list.count += 1;
      out += `\n${indent}${list?.ordered ? `${list.count}. ` : "- "}`;
    } else if (name === "br") {
      out += "\n";
    } else if ((name === "td" || name === "th") && closing) {
      out += " | ";
    } else if (BLOCK_TAGS.has(name) && closing) {
      out += "\n";
    }
  }

  return normalizeExtractedText(
    out
      .replace(/\[\[(hl|b|u|s)\]\]\[\[\/\1\]\]/g, "")
      .replace(/ \| \n/g, "\n"),
  );
}

export async function extractDocxMarkedText(
  buffer: Buffer | Uint8Array,
): Promise<string> {
  const mammoth = await import("mammoth");
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const result = await mammoth.convertToHtml(
    { buffer: input },
    { styleMap: STYLE_MAP, convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
  );
  const text = markedTextFromHtml(result.value ?? "");
  if (!text) throw new EmptyFrameworkTextError("docx");
  return text;
}

import {
  PDFDocument,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import {
  EXPORT_COLORS,
  EXPORT_THEME,
  isRoutineHeadingLine,
  splitBodyLines,
} from "./exportTheme";
import type { HydratedLessonPlanExportDocument } from "./hydrateAssets";
import { fitImageSize, sniffImageKind } from "./imageSizing";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const textColor = rgb(
  EXPORT_COLORS.text.r,
  EXPORT_COLORS.text.g,
  EXPORT_COLORS.text.b,
);
const headingColor = rgb(
  EXPORT_COLORS.heading.r,
  EXPORT_COLORS.heading.g,
  EXPORT_COLORS.heading.b,
);
const linkColor = rgb(
  EXPORT_COLORS.link.r,
  EXPORT_COLORS.link.g,
  EXPORT_COLORS.link.b,
);

/** Rubric level header like "2 — Approaching Standard". */
function looksLikeRubricLevel(line: string): boolean {
  return /^\d+\s+[—–-]\s+\S/.test(line.trim());
}

/**
 * Helvetica (WinAnsi) can't encode every Unicode glyph. Map common punctuation
 * so drawText doesn't throw mid-document and truncate the export.
 */
function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrapLine(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= CONTENT_WIDTH) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) > CONTENT_WIDTH) {
      let chunk = "";
      for (const ch of word) {
        const trial = chunk + ch;
        if (font.widthOfTextAtSize(trial, size) > CONTENT_WIDTH && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = trial;
        }
      }
      current = chunk;
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

async function embedRaster(
  pdf: PDFDocument,
  bytes: Uint8Array,
): Promise<PDFImage | null> {
  const kind = sniffImageKind(bytes);
  try {
    if (kind === "jpg") return await pdf.embedJpg(bytes);
    if (kind === "png") return await pdf.embedPng(bytes);
  } catch (error) {
    console.error("pdf embed image failed", error);
  }
  return null;
}

function addUriLink(
  pdf: PDFDocument,
  page: PDFPage,
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const annot = pdf.context.register(
    pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(url),
      },
    }),
  );
  page.node.addAnnot(annot);
}

/** Build a .pdf with embedded images, video thumbnails, and clickable URLs. */
export async function buildLessonPlanPdf(
  doc: HydratedLessonPlanExportDocument,
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed >= MARGIN) return;
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  /**
   * Avoid orphaning a heading / rubric level at the bottom of a page with no
   * room for the lines that belong with it (looks like a "cut off" export).
   */
  const ensureParagraphStart = (lineHeight: number, minLines = 4) => {
    ensureSpace(lineHeight * minLines);
  };

  const drawWrapped = (
    text: string,
    size: number,
    useBold: boolean,
    gapAfter: number,
    color = textColor,
  ) => {
    const active: PDFFont = useBold ? fontBold : font;
    const lineHeight = size + 4;
    for (const source of splitBodyLines(text)) {
      if (source.length === 0) {
        ensureSpace(lineHeight + EXPORT_THEME.blankLineExtra);
        y -= lineHeight + EXPORT_THEME.blankLineExtra;
        continue;
      }
      ensureParagraphStart(lineHeight);
      for (const line of wrapLine(source, active, size)) {
        ensureSpace(lineHeight);
        page.drawText(toWinAnsiSafe(line.length > 0 ? line : " "), {
          x: MARGIN,
          y: y - size,
          size,
          font: active,
          color,
          maxWidth: CONTENT_WIDTH,
        });
        y -= lineHeight;
      }
    }
    y -= gapAfter;
  };

  const drawBody = (body: string, gapAfter: number) => {
    const size = EXPORT_THEME.bodySize;
    const lineHeight = size + 4;
    for (const source of splitBodyLines(body)) {
      if (source.length === 0) {
        ensureSpace(lineHeight + EXPORT_THEME.blankLineExtra);
        y -= lineHeight + EXPORT_THEME.blankLineExtra;
        continue;
      }
      const useBold = isRoutineHeadingLine(source);
      const active: PDFFont = useBold ? fontBold : font;
      // Rubric level headers / routine labels should stay with following lines.
      ensureParagraphStart(lineHeight, useBold || looksLikeRubricLevel(source) ? 5 : 4);
      for (const line of wrapLine(source, active, size)) {
        ensureSpace(lineHeight);
        page.drawText(toWinAnsiSafe(line.length > 0 ? line : " "), {
          x: MARGIN,
          y: y - size,
          size,
          font: active,
          color: textColor,
          maxWidth: CONTENT_WIDTH,
        });
        y -= lineHeight;
      }
    }
    y -= gapAfter;
  };

  const drawImage = async (
    bytes: Uint8Array,
    maxW: number,
    maxH: number,
  ): Promise<{ page: PDFPage; x: number; y: number; w: number; h: number } | null> => {
    const embedded = await embedRaster(pdf, bytes);
    if (!embedded) return null;
    const size = fitImageSize(embedded.width, embedded.height, maxW, maxH);
    ensureSpace(size.height + 8);
    const drawY = y - size.height;
    page.drawImage(embedded, {
      x: MARGIN,
      y: drawY,
      width: size.width,
      height: size.height,
    });
    y = drawY - 8;
    return { page, x: MARGIN, y: drawY, w: size.width, h: size.height };
  };

  drawWrapped(
    doc.title,
    EXPORT_THEME.titleSize,
    true,
    EXPORT_THEME.afterTitleGap,
    headingColor,
  );
  if (doc.subtitle) {
    drawWrapped(
      doc.subtitle,
      EXPORT_THEME.subtitleSize,
      false,
      EXPORT_THEME.afterSubtitleGap,
    );
  }

  for (const section of doc.sections) {
    drawWrapped(
      section.heading,
      EXPORT_THEME.sectionHeadingSize,
      true,
      EXPORT_THEME.afterSectionHeadingGap,
      headingColor,
    );
    if (section.body.length > 0) {
      drawBody(section.body, EXPORT_THEME.afterBodyGap);
    }

    for (const image of section.images) {
      const caption = image.caption.trim();
      if (image.bytes) {
        // Fixed chrome (rubric) is wide — use full content width.
        const maxW = image.publicPath ? CONTENT_WIDTH : 480;
        const maxH = image.publicPath ? 320 : 360;
        const placed = await drawImage(image.bytes, maxW, maxH);
        if (!placed) {
          drawWrapped("Image (could not embed)", 10, false, 6);
        } else if (caption) {
          drawWrapped(caption, EXPORT_THEME.captionSize, false, 10);
        } else {
          y -= 10;
        }
      } else {
        drawWrapped("Image (missing file)", 10, false, 6);
      }
    }

    for (const link of section.links) {
      const title = link.title || "Video / link";

      if (link.thumbnailBytes) {
        const placed = await drawImage(link.thumbnailBytes, 420, 236);
        if (placed) {
          addUriLink(
            pdf,
            placed.page,
            link.url,
            placed.x,
            placed.y,
            placed.w,
            placed.h,
          );
        }
      }

      const linkLabel = toWinAnsiSafe(`${title} — ${link.url}`);
      const size = EXPORT_THEME.linkSize;
      const lines = wrapLine(linkLabel, font, size);
      for (const line of lines) {
        ensureSpace(size + 4);
        const textWidth = Math.min(
          CONTENT_WIDTH,
          font.widthOfTextAtSize(line, size),
        );
        const textY = y - size;
        page.drawText(line, {
          x: MARGIN,
          y: textY,
          size,
          font,
          color: linkColor,
        });
        addUriLink(pdf, page, link.url, MARGIN, textY - 2, textWidth, size + 4);
        y -= size + 4;
      }
      y -= 8;
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

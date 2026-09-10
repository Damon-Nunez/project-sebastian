import {
  PDFDocument,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { HydratedLessonPlanExportDocument } from "./hydrateAssets";
import { fitImageSize, sniffImageKind } from "./imageSizing";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

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

  const drawWrapped = (
    text: string,
    size: number,
    useBold: boolean,
    gapAfter: number,
    color = rgb(0.1, 0.1, 0.12),
  ) => {
    const active: PDFFont = useBold ? fontBold : font;
    const lineHeight = size + 4;
    for (const source of text.split(/\r?\n/)) {
      for (const line of wrapLine(source, active, size)) {
        ensureSpace(lineHeight);
        page.drawText(line.length > 0 ? line : " ", {
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

  drawWrapped(doc.title, 18, true, 8);
  if (doc.subtitle) {
    drawWrapped(doc.subtitle, 11, false, 14);
  }

  for (const section of doc.sections) {
    drawWrapped(section.heading, 13, true, 6);
    if (section.body.trim()) {
      drawWrapped(section.body, 11, false, 8);
    }

    for (const image of section.images) {
      const label = image.caption || image.originalFilename || "Image";
      if (image.bytes) {
        const placed = await drawImage(image.bytes, 480, 360);
        if (!placed) {
          drawWrapped(`Image (could not embed): ${label}`, 10, false, 6);
        } else {
          drawWrapped(label, 9, false, 10);
        }
      } else {
        drawWrapped(`Image (missing file): ${label}`, 10, false, 6);
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

      const linkLabel = `${title} — ${link.url}`;
      const size = 10;
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
          color: rgb(0.05, 0.35, 0.75),
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

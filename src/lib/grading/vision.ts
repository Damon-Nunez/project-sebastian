/**
 * Vision fallback for photos and scanned PDFs (Ticket 10 / SCRUM-132).
 * Server only: OCR runs locally with tesseract.js; nothing here calls the AI.
 * Each page is stored as an original plus a masked copy, and `loadMaskedPages`
 * is the only way to get page bytes into a vision prompt.
 */
import path from "node:path";
import type { Worker } from "tesseract.js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  MAX_VISION_PAGES,
  STUDENT_WORK_BUCKET,
  type VisionPage,
} from "./studentWorkFiles";
import {
  maskBoxesForPage,
  rosterMaskTokens,
  type MaskBox,
  type OcrWord,
} from "./visionMask";

const MAX_IMAGE_EDGE_PX = 2000;
/** Claude downsizes past this anyway; sending smaller keeps requests light. */
const MAX_AI_IMAGE_EDGE_PX = 1568;
const PDF_RENDER_WIDTH_PX = 1700;

const OCR_LANG_PATH = path.join(
  process.cwd(),
  "node_modules",
  "@tesseract.js-data",
  "eng",
  "4.0.0_best_int",
);

const globalForOcr = globalThis as typeof globalThis & {
  ocrWorker?: Promise<Worker>;
};

function getOcrWorker(): Promise<Worker> {
  globalForOcr.ocrWorker ??= import("tesseract.js")
    .then(({ createWorker }) =>
      createWorker("eng", 1, { langPath: OCR_LANG_PATH, cacheMethod: "none" }),
    )
    .catch((error) => {
      globalForOcr.ocrWorker = undefined;
      throw error;
    });
  return globalForOcr.ocrWorker;
}

/** Words + positions in the same pixel space as `jpeg`. Empty when OCR fails. */
async function ocrPage(jpeg: Buffer): Promise<{ text: string; words: OcrWord[] }> {
  try {
    const { default: sharp } = await import("sharp");
    const input = await sharp(jpeg).greyscale().normalise().png().toBuffer();
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(input, {}, { text: true, blocks: true });
    const words = (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.flatMap((line) =>
          line.words.map((word) => ({ text: word.text, ...word.bbox })),
        ),
      ),
    );
    return { text: data.text ?? "", words };
  } catch (error) {
    console.error("OCR failed — masking header strip only", error);
    return { text: "", words: [] };
  }
}

async function drawMask(jpeg: Buffer, boxes: MaskBox[]): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const { width, height } = await sharp(jpeg).metadata();
  const rects = boxes
    .map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#000"/>`)
    .join("");
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`,
  );
  return sharp(jpeg)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** Render a scanned PDF's pages to JPEG (first MAX_VISION_PAGES only). */
export async function renderPdfPages(bytes: Buffer): Promise<Buffer[]> {
  const [{ PDFParse }, { default: sharp }] = await Promise.all([
    import("pdf-parse"),
    import("sharp"),
  ]);
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getScreenshot({
      first: MAX_VISION_PAGES,
      desiredWidth: PDF_RENDER_WIDTH_PX,
      imageDataUrl: false,
      imageBuffer: true,
    });
    return Promise.all(
      result.pages.map((page) =>
        sharp(Buffer.from(page.data))
          .flatten({ background: "#fff" })
          .resize({
            width: MAX_IMAGE_EDGE_PX,
            height: MAX_IMAGE_EDGE_PX,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer(),
      ),
    );
  } finally {
    await parser.destroy();
  }
}

async function uploadJpeg(storagePath: string, jpeg: Buffer): Promise<void> {
  const { error } = await createAdminSupabaseClient()
    .storage.from(STUDENT_WORK_BUCKET)
    .upload(storagePath, jpeg, { contentType: "image/jpeg", upsert: true });
  if (error) {
    throw new Error(`Failed to store page image: ${error.message}`);
  }
}

async function downloadImage(storagePath: string): Promise<Buffer> {
  const { data, error } = await createAdminSupabaseClient()
    .storage.from(STUDENT_WORK_BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(`Page image not found: ${error?.message ?? "missing"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

type Roster = Array<{ name: string; nickname?: string | null }>;

/** OCR one page, black out names (+ header strip on page 1), store the masked copy. */
async function maskAndStorePage(input: {
  jpeg: Buffer;
  originalPath: string;
  maskedPath: string;
  pageIndex: number;
  rosterTokens: ReadonlySet<string>;
}): Promise<{ page: VisionPage; text: string }> {
  const { default: sharp } = await import("sharp");
  const { width = 0, height = 0 } = await sharp(input.jpeg).metadata();
  const ocr = await ocrPage(input.jpeg);
  const mask = maskBoxesForPage({
    words: ocr.words,
    width,
    height,
    pageIndex: input.pageIndex,
    rosterTokens: input.rosterTokens,
  });
  await uploadJpeg(input.maskedPath, await drawMask(input.jpeg, mask.boxes));
  return {
    page: {
      originalPath: input.originalPath,
      maskedPath: input.maskedPath,
      width,
      height,
      headerStrip: mask.headerStrip,
      nameBoxes: mask.nameBoxes,
    },
    text: ocr.text,
  };
}

/**
 * Store originals that aren't in Storage yet (rendered PDF pages), then OCR
 * and mask every page. Returns the OCR text for local sorting only — it can
 * hold misspelled names, so it is never sent to the AI.
 */
export async function prepareVisionPages(input: {
  pages: Array<{
    jpeg: Buffer;
    originalPath: string;
    maskedPath: string;
    storeOriginal: boolean;
  }>;
  roster: Roster;
}): Promise<{ pages: VisionPage[]; text: string }> {
  const rosterTokens = rosterMaskTokens(input.roster);
  const pages: VisionPage[] = [];
  const texts: string[] = [];
  for (const [pageIndex, page] of input.pages.entries()) {
    if (page.storeOriginal) await uploadJpeg(page.originalPath, page.jpeg);
    const result = await maskAndStorePage({ ...page, pageIndex, rosterTokens });
    pages.push(result.page);
    texts.push(result.text.trim());
  }
  return { pages, text: texts.filter(Boolean).join("\n\n") };
}

/**
 * Re-mask a page for its new position (combining photos into one paper):
 * the header strip only belongs on page 1. Writes to a new file so the old
 * masked copy stays valid until the combined row is saved.
 */
export async function remaskVisionPage(input: {
  page: VisionPage;
  pageIndex: number;
  roster: Roster;
}): Promise<VisionPage> {
  if (input.page.headerStrip === (input.pageIndex === 0)) return input.page;
  const jpeg = await downloadImage(input.page.originalPath);
  const { page } = await maskAndStorePage({
    jpeg,
    originalPath: input.page.originalPath,
    maskedPath: input.page.maskedPath.replace(/\.jpg$/i, `.p${input.pageIndex + 1}.jpg`),
    pageIndex: input.pageIndex,
    rosterTokens: rosterMaskTokens(input.roster),
  });
  return page;
}

declare const maskedPageBrand: unique symbol;

/** A page image that went through masking — the only image type the AI accepts. */
export type MaskedPageImage = {
  readonly [maskedPageBrand]: true;
  mediaType: "image/jpeg";
  base64: string;
};

export async function loadMaskedPages(pages: VisionPage[]): Promise<MaskedPageImage[]> {
  const { default: sharp } = await import("sharp");
  return Promise.all(
    pages.map(async (page) => {
      const jpeg = await sharp(await downloadImage(page.maskedPath))
        .resize({
          width: MAX_AI_IMAGE_EDGE_PX,
          height: MAX_AI_IMAGE_EDGE_PX,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      return {
        mediaType: "image/jpeg",
        base64: jpeg.toString("base64"),
      } as MaskedPageImage;
    }),
  );
}

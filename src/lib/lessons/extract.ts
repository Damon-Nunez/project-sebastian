/**
 * Ticket 5.2 — turn uploaded district framework files into plain text
 * for the formula pre-fill parser. Server-side only (mammoth / pdf-parse).
 */

export type FrameworkFormat = "docx" | "pdf";

export type ExtractedFrameworkText = {
  format: FrameworkFormat;
  text: string;
  originalFilename: string | null;
};

export class UnsupportedFrameworkFormatError extends Error {
  readonly filename: string | null;

  constructor(filename: string | null, message?: string) {
    super(
      message ??
        `Unsupported framework file type${filename ? `: ${filename}` : ""}. Upload a .docx or .pdf.`,
    );
    this.name = "UnsupportedFrameworkFormatError";
    this.filename = filename;
  }
}

export class EmptyFrameworkTextError extends Error {
  readonly format: FrameworkFormat;

  constructor(format: FrameworkFormat) {
    super(`No extractable text found in ${format.toUpperCase()} framework file.`);
    this.name = "EmptyFrameworkTextError";
    this.format = format;
  }
}

/** pdf-parse injects markers like `-- 1 of 18 --`; drop them for cleaner parse input. */
const PDF_PAGE_MARKER = /^--\s+\d+\s+of\s+\d+\s+--$/;

/** Normalize for downstream parsing: stable newlines, trim, collapse huge gaps. */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .filter((line) => !PDF_PAGE_MARKER.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function detectFrameworkFormat(
  filename: string | null | undefined,
): FrameworkFormat | null {
  const lower = (filename ?? "").trim().toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

function toUint8Array(buffer: Buffer | Uint8Array): Uint8Array {
  if (buffer instanceof Uint8Array && !Buffer.isBuffer(buffer)) {
    // Copy — pdf-parse may transfer ownership of TypedArrays to a worker.
    return new Uint8Array(buffer);
  }
  return new Uint8Array(buffer);
}

export async function extractDocxText(
  buffer: Buffer | Uint8Array,
): Promise<string> {
  const mammoth = await import("mammoth");
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const result = await mammoth.extractRawText({ buffer: input });
  const text = normalizeExtractedText(result.value ?? "");
  if (!text) throw new EmptyFrameworkTextError("docx");
  return text;
}

export async function extractPdfText(
  buffer: Buffer | Uint8Array,
): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: toUint8Array(buffer) });
  try {
    const result = await parser.getText();
    const text = normalizeExtractedText(result.text ?? "");
    if (!text) throw new EmptyFrameworkTextError("pdf");
    return text;
  } finally {
    await parser.destroy();
  }
}

/**
 * Detect format from filename and extract plain text from the file bytes.
 */
export async function extractFrameworkText(input: {
  buffer: Buffer | Uint8Array;
  filename: string;
}): Promise<ExtractedFrameworkText> {
  const format = detectFrameworkFormat(input.filename);
  if (!format) {
    throw new UnsupportedFrameworkFormatError(input.filename);
  }

  const text =
    format === "docx"
      ? await extractDocxText(input.buffer)
      : await extractPdfText(input.buffer);

  return {
    format,
    text,
    originalFilename: input.filename,
  };
}

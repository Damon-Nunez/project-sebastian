import sharp from "sharp";
import { sniffImageKind, type ImageKind } from "./imageSizing";

export type NormalizedExportImage = {
  bytes: Uint8Array;
  kind: "png" | "jpg";
  mimeType: "image/png" | "image/jpeg";
};

/**
 * Normalize any supported upload (PNG/JPEG/WebP/GIF) to PNG or JPEG so
 * docx ImageRun can embed it. Prefer PNG to keep transparency.
 */
export async function normalizeImageForExport(
  bytes: Uint8Array,
  mimeHint?: string,
): Promise<NormalizedExportImage | null> {
  if (!bytes || bytes.byteLength === 0) return null;

  const sniffed = sniffImageKind(bytes);
  // Already embeddable as-is for docx.
  if (sniffed === "jpg") {
    return {
      bytes,
      kind: "jpg",
      mimeType: "image/jpeg",
    };
  }
  if (sniffed === "png") {
    return {
      bytes,
      kind: "png",
      mimeType: "image/png",
    };
  }

  // WebP / GIF / unknown → convert via sharp.
  try {
    const png = await sharp(Buffer.from(bytes), {
      animated: false,
      failOn: "none",
    })
      .rotate() // honor EXIF orientation
      .png({ compressionLevel: 8 })
      .toBuffer();

    return {
      bytes: new Uint8Array(png),
      kind: "png",
      mimeType: "image/png",
    };
  } catch (error) {
    console.error(
      "normalizeImageForExport failed",
      mimeHint ?? sniffed ?? "unknown",
      error,
    );
    return null;
  }
}

/** After normalize, kind is always jpg|png for builders. */
export function normalizedKind(
  normalized: NormalizedExportImage,
): Extract<ImageKind, "jpg" | "png"> {
  return normalized.kind;
}

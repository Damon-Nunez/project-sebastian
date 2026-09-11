/** Shared image sizing helpers for docx / pdf export. */

export type ImageKind = "jpg" | "png" | "gif" | "bmp";

export function mimeToDocxImageType(mime: string): ImageKind | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/gif") return "gif";
  if (m === "image/bmp") return "bmp";
  // webp not supported by docx ImageRun — callers fall back to caption/URL.
  return null;
}

export function sniffImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return "gif";
  }
  return null;
}

/** Read width/height from PNG IHDR when present. */
export function readPngSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }
  // IHDR chunk starts at byte 8; width/height are big-endian at 16 and 20.
  const width =
    ((bytes[16] ?? 0) << 24) |
    ((bytes[17] ?? 0) << 16) |
    ((bytes[18] ?? 0) << 8) |
    (bytes[19] ?? 0);
  const height =
    ((bytes[20] ?? 0) << 24) |
    ((bytes[21] ?? 0) << 16) |
    ((bytes[22] ?? 0) << 8) |
    (bytes[23] ?? 0);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/** Fit inside max box; default 16:9 when natural size unknown. */
export function fitImageSize(
  naturalWidth: number | null,
  naturalHeight: number | null,
  maxWidth: number,
  maxHeight: number,
  fallbackAspect = 16 / 9,
): { width: number; height: number } {
  const w = naturalWidth && naturalWidth > 0 ? naturalWidth : maxWidth;
  const h =
    naturalHeight && naturalHeight > 0
      ? naturalHeight
      : Math.round(w / fallbackAspect);
  const scale = Math.min(maxWidth / w, maxHeight / h, 1);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

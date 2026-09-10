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

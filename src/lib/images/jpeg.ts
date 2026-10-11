/**
 * Shared JPEG sizing for stored photos and images sent to the model.
 * 1568px is the long edge Claude downsizes to anyway.
 */

export const STORED_IMAGE_EDGE_PX = 2000;
export const MODEL_IMAGE_EDGE_PX = 1568;
export const JPEG_QUALITY = 85;

export function jpegEdgeResize(edgePx: number) {
  return {
    width: edgePx,
    height: edgePx,
    fit: "inside" as const,
    withoutEnlargement: true,
  };
}

export async function resizeToJpeg(
  input: Buffer,
  edgePx: number,
  options: { rotate?: boolean } = {},
): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const pipeline = options.rotate ? sharp(input).rotate() : sharp(input);
  return pipeline
    .resize(jpegEdgeResize(edgePx))
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

/** HEIC becomes JPEG, then every photo is rotated and capped for storage. */
export async function normalizeStoredImage(
  bytes: Buffer,
  format: string,
): Promise<Buffer> {
  let input = bytes;
  if (format === "heic") {
    const { default: convertHeic } = await import("heic-convert");
    const jpeg = await convertHeic({
      buffer: bytes as unknown as ArrayBufferLike,
      format: "JPEG",
      quality: 0.9,
    });
    input = Buffer.from(jpeg);
  }
  return resizeToJpeg(input, STORED_IMAGE_EDGE_PX, { rotate: true });
}

export async function jpegBase64ForModel(
  jpeg: Buffer,
): Promise<{ mediaType: "image/jpeg"; base64: string }> {
  const resized = await resizeToJpeg(jpeg, MODEL_IMAGE_EDGE_PX);
  return { mediaType: "image/jpeg", base64: resized.toString("base64") };
}

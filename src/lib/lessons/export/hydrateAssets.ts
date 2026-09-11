import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { promises as fs } from "node:fs";
import path from "node:path";
import { LESSON_PLAN_IMAGES_BUCKET } from "../images";
import type {
  ExportImageRef,
  ExportLink,
  ExportSection,
  LessonPlanExportDocument,
} from "./documentModel";
import { normalizeImageForExport } from "./normalizeImage";

export type HydratedExportImage = ExportImageRef & {
  bytes: Uint8Array | null;
  /** Set when bytes were normalized for pdf/docx embed (png/jpeg). */
  embedMimeType?: "image/png" | "image/jpeg";
};

export type HydratedExportLink = ExportLink & {
  thumbnailBytes: Uint8Array | null;
};

export type HydratedExportSection = Omit<ExportSection, "links" | "images"> & {
  links: HydratedExportLink[];
  images: HydratedExportImage[];
};

export type HydratedLessonPlanExportDocument = Omit<
  LessonPlanExportDocument,
  "sections"
> & {
  sections: HydratedExportSection[];
};

async function readPublicAssetBytes(
  publicPath: string,
): Promise<Uint8Array | null> {
  try {
    const publicRoot = path.resolve(process.cwd(), "public");
    const full = path.resolve(publicRoot, publicPath);
    const rootPrefix = publicRoot.endsWith(path.sep)
      ? publicRoot
      : publicRoot + path.sep;
    if (full !== publicRoot && !full.startsWith(rootPrefix)) {
      console.error("export public asset path escaped public/", publicPath);
      return null;
    }
    return new Uint8Array(await fs.readFile(full));
  } catch (error) {
    console.error("export public asset read failed", publicPath, error);
    return null;
  }
}

async function downloadStorageBytes(
  storagePath: string,
): Promise<Uint8Array | null> {
  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.storage
      .from(LESSON_PLAN_IMAGES_BUCKET)
      .download(storagePath);
    if (error || !data) {
      console.error("export image download failed", storagePath, error);
      return null;
    }
    return new Uint8Array(await data.arrayBuffer());
  } catch (error) {
    console.error("export image download threw", storagePath, error);
    return null;
  }
}

async function fetchUrlBytes(url: string): Promise<Uint8Array | null> {
  if (!url.trim()) return null;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    console.error("export thumbnail fetch failed", url, error);
    return null;
  }
}

async function loadEmbeddableImage(
  raw: Uint8Array | null,
  mimeHint?: string,
): Promise<{ bytes: Uint8Array; embedMimeType: "image/png" | "image/jpeg" } | null> {
  if (!raw) return null;
  const normalized = await normalizeImageForExport(raw, mimeHint);
  if (!normalized) return null;
  return { bytes: normalized.bytes, embedMimeType: normalized.mimeType };
}

async function loadExportImageBytes(
  image: ExportImageRef,
): Promise<Uint8Array | null> {
  if (image.publicPath?.trim()) {
    return readPublicAssetBytes(image.publicPath.trim());
  }
  if (!image.storagePath.trim()) return null;
  return downloadStorageBytes(image.storagePath);
}

/**
 * Load binary assets for export: lesson images from Storage + link thumbnails
 * (YouTube hqdefault, etc.) over HTTPS. WebP/GIF are converted to PNG.
 * Fixed chrome (e.g. classwork rubric) loads from /public.
 */
export async function hydrateExportDocument(
  doc: LessonPlanExportDocument,
): Promise<HydratedLessonPlanExportDocument> {
  const sections: HydratedExportSection[] = [];

  for (const section of doc.sections) {
    const images: HydratedExportImage[] = await Promise.all(
      section.images.map(async (image) => {
        const raw = await loadExportImageBytes(image);
        const embeddable = await loadEmbeddableImage(raw, image.mimeType);
        return {
          ...image,
          bytes: embeddable?.bytes ?? null,
          embedMimeType: embeddable?.embedMimeType,
        };
      }),
    );

    const links: HydratedExportLink[] = await Promise.all(
      section.links.map(async (link) => {
        const raw = await fetchUrlBytes(link.thumbnailUrl);
        const embeddable = await loadEmbeddableImage(raw, "image/jpeg");
        return {
          ...link,
          thumbnailBytes: embeddable?.bytes ?? raw,
        };
      }),
    );

    sections.push({
      heading: section.heading,
      body: section.body,
      links,
      images,
    });
  }

  return {
    title: doc.title,
    subtitle: doc.subtitle,
    sections,
  };
}

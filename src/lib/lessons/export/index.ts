import { buildLessonPlanDocx } from "./buildDocx";
import { buildLessonPlanPdf } from "./buildPdf";
import {
  buildLessonPlanExportDocument,
  formatLessonPlanExportFilename,
  type LessonPlanExportLabels,
} from "./documentModel";
import { hydrateExportDocument } from "./hydrateAssets";
import type { LessonPlanContent } from "../content";

export type LessonExportFormat = "docx" | "pdf";

export type BuiltLessonExport = {
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

const MIME: Record<LessonExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/** Build a downloadable lesson plan file from Edited content (embeds media). */
export async function buildLessonPlanExport(input: {
  content: LessonPlanContent;
  labels?: LessonPlanExportLabels;
  format: LessonExportFormat;
}): Promise<BuiltLessonExport> {
  const labels = input.labels ?? {};
  const skeleton = buildLessonPlanExportDocument(input.content, labels);
  const document = await hydrateExportDocument(skeleton);
  const bytes =
    input.format === "docx"
      ? await buildLessonPlanDocx(document)
      : await buildLessonPlanPdf(document);

  return {
    filename: formatLessonPlanExportFilename(labels, input.format),
    mimeType: MIME[input.format],
    bytes,
  };
}

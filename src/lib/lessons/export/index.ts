import { buildLessonPlanDocx } from "./buildDocx";
import {
  buildLessonPlanExportDocument,
  formatLessonPlanExportFilename,
  type LessonPlanExportLabels,
} from "./documentModel";
import { hydrateExportDocument } from "./hydrateAssets";
import type { LessonPlanContent } from "../content";

export type BuiltLessonExport = {
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Build a downloadable .docx lesson plan from Edited content (embeds media). */
export async function buildLessonPlanExport(input: {
  content: LessonPlanContent;
  labels?: LessonPlanExportLabels;
}): Promise<BuiltLessonExport> {
  const labels = input.labels ?? {};
  const skeleton = buildLessonPlanExportDocument(input.content, labels);
  const document = await hydrateExportDocument(skeleton);
  const bytes = await buildLessonPlanDocx(document);

  return {
    filename: formatLessonPlanExportFilename(labels),
    mimeType: DOCX_MIME,
    bytes,
  };
}

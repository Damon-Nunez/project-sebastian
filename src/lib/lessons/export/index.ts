import { buildLessonPlanDocx } from "./buildDocx";
import {
  buildLessonPlanExportDocument,
  formatLessonPlanExportFilename,
  type LessonPlanExportLabels,
} from "./documentModel";
import { buildExportGroupingsTable } from "./groupingsModel";
import { hydrateExportDocument } from "./hydrateAssets";
import type { LessonPlanContent } from "../content";
import type { SectionGroupsMap } from "../sectionGroups";
import type { PeriodWithRoster } from "@/lib/roster/periods";

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
  sectionGroups?: SectionGroupsMap;
  periods?: PeriodWithRoster[];
}): Promise<BuiltLessonExport> {
  const labels = input.labels ?? {};
  const groupings = buildExportGroupingsTable(
    input.periods ?? [],
    input.sectionGroups ?? {},
  );
  const skeleton = buildLessonPlanExportDocument(input.content, labels, {
    groupings,
  });
  const document = await hydrateExportDocument(skeleton);
  const bytes = await buildLessonPlanDocx(document);

  return {
    filename: formatLessonPlanExportFilename(labels),
    mimeType: DOCX_MIME,
    bytes,
  };
}

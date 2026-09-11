import type {
  LessonPlanContent,
  LessonPlanImage,
  LessonPlanLink,
} from "../content";
import {
  STANDARD_CLASSWORK_RUBRIC,
  STANDARD_CLASSWORK_RUBRIC_IMAGE,
} from "../standardRubric";

export type ExportLink = {
  title: string;
  url: string;
  thumbnailUrl: string;
  provider: "youtube" | "vimeo" | "other";
};

export type ExportImageRef = {
  id: string;
  caption: string;
  originalFilename: string;
  mimeType: string;
  /** Supabase storage path; empty when `publicPath` is set. */
  storagePath: string;
  /** Path relative to /public for fixed lesson chrome (rubric, etc.). */
  publicPath?: string;
};

export type ExportSection = {
  heading: string;
  body: string;
  links: ExportLink[];
  images: ExportImageRef[];
};

export type LessonPlanExportDocument = {
  title: string;
  subtitle: string | null;
  sections: ExportSection[];
};

export type LessonPlanExportLabels = {
  moduleLabel?: string | null;
  unitLabel?: string | null;
  lessonLabel?: string | null;
};

function trimOrEmpty(value: string): string {
  return value.trim();
}

function minutesSuffix(minutes: number | null | undefined): string {
  if (minutes == null) return "";
  return ` (${minutes} min)`;
}

function toExportLink(link: LessonPlanLink): ExportLink {
  return {
    title: link.title.trim() || link.caption.trim() || "Video / link",
    url: link.url,
    thumbnailUrl: link.thumbnailUrl.trim(),
    provider: link.provider,
  };
}

function toExportImage(image: LessonPlanImage): ExportImageRef {
  return {
    id: image.id,
    caption: image.caption.trim(),
    originalFilename: image.originalFilename,
    mimeType: image.mimeType,
    storagePath: image.storagePath,
  };
}

function attachmentsForSection(
  content: LessonPlanContent,
  sectionKey: string,
): { links: ExportLink[]; images: ExportImageRef[] } {
  return {
    links: content.lessonPlanLinks
      .filter((link) => link.sectionKey === sectionKey)
      .map(toExportLink),
    images: content.images
      .filter((img) => img.sectionKey === sectionKey)
      .map(toExportImage),
  };
}

function pushSection(
  sections: ExportSection[],
  heading: string,
  body: string,
  attachments: { links: ExportLink[]; images: ExportImageRef[] } = {
    links: [],
    images: [],
  },
) {
  const trimmed = trimOrEmpty(body);
  if (
    !trimmed &&
    attachments.links.length === 0 &&
    attachments.images.length === 0
  ) {
    return;
  }
  sections.push({
    heading,
    body: trimmed,
    links: attachments.links,
    images: attachments.images,
  });
}

export function formatLessonPlanExportTitle(
  labels: LessonPlanExportLabels,
): string {
  const bits = [
    labels.moduleLabel?.trim()
      ? `Module ${labels.moduleLabel.trim()}`
      : null,
    labels.unitLabel?.trim() ? `Unit ${labels.unitLabel.trim()}` : null,
    labels.lessonLabel?.trim()
      ? `Lesson ${labels.lessonLabel.trim()}`
      : null,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : "Lesson Plan";
}

export function formatLessonPlanExportFilename(
  labels: LessonPlanExportLabels,
): string {
  const bits = [
    labels.moduleLabel?.trim()
      ? `M${labels.moduleLabel.trim()}`
      : null,
    labels.unitLabel?.trim() ? `U${labels.unitLabel.trim()}` : null,
    labels.lessonLabel?.trim()
      ? `L${labels.lessonLabel.trim()}`
      : null,
  ].filter(Boolean);
  const base = bits.length > 0 ? bits.join("-") : "lesson-plan";
  const safe = base.replace(/[^\w.\-]+/g, "_");
  return `${safe}.docx`;
}

function isLearningTargetsExtra(label: string): boolean {
  return label.trim().toLowerCase() === "learning targets";
}

/** Learning Targets live in extras until they become a first-class field. */
function learningTargetsBody(content: LessonPlanContent): string {
  const block = content.extras.find((extra) =>
    isLearningTargetsExtra(extra.label),
  );
  return trimOrEmpty(block?.body ?? "");
}

function formatStandardsAndTargetsBody(
  standards: string,
  targets: string,
): string {
  const codes = trimOrEmpty(standards);
  const learningTargets = trimOrEmpty(targets);
  if (codes && learningTargets) return `${codes}\n\n${learningTargets}`;
  return codes || learningTargets;
}

function standardRubricImageRef(): ExportImageRef {
  return {
    id: STANDARD_CLASSWORK_RUBRIC_IMAGE.id,
    caption: "",
    originalFilename: STANDARD_CLASSWORK_RUBRIC_IMAGE.filename,
    mimeType: STANDARD_CLASSWORK_RUBRIC_IMAGE.mimeType,
    storagePath: "",
    publicPath: STANDARD_CLASSWORK_RUBRIC_IMAGE.publicPath,
  };
}

/**
 * Flatten Edited lesson content into a printable document model.
 * Attachments stay structured so builders can embed images + video thumbs.
 */
export function buildLessonPlanExportDocument(
  content: LessonPlanContent,
  labels: LessonPlanExportLabels = {},
): LessonPlanExportDocument {
  const title = formatLessonPlanExportTitle(labels);
  const subtitle = content.lessonDate
    ? `Date: ${content.lessonDate}`
    : null;

  const sections: ExportSection[] = [];

  pushSection(
    sections,
    "Standards / Learning targets",
    formatStandardsAndTargetsBody(
      content.standards,
      learningTargetsBody(content),
    ),
    attachmentsForSection(content, "learningTargets"),
  );
  pushSection(
    sections,
    "Agenda",
    content.agenda,
    attachmentsForSection(content, "agenda"),
  );
  pushSection(
    sections,
    "Vocabulary",
    content.vocabulary,
    attachmentsForSection(content, "vocabulary"),
  );
  pushSection(
    sections,
    "Entrance ticket",
    content.entranceTicket,
    attachmentsForSection(content, "entranceTicket"),
  );
  pushSection(sections, STANDARD_CLASSWORK_RUBRIC.title, "", {
    links: [],
    images: [standardRubricImageRef()],
  });
  pushSection(
    sections,
    "Materials",
    content.materials,
    attachmentsForSection(content, "materials"),
  );
  pushSection(
    sections,
    `${content.opening.label || "Opening"}${minutesSuffix(content.opening.minutes)}`,
    content.opening.body,
    attachmentsForSection(content, "opening"),
  );

  for (const block of content.workTimes) {
    pushSection(
      sections,
      `${block.label || `Work Time ${block.key}`}${minutesSuffix(block.minutes)}`,
      block.body,
      attachmentsForSection(content, `workTime:${block.key}`),
    );
  }

  pushSection(
    sections,
    `${content.closing.label || "Closing"}${minutesSuffix(content.closing.minutes)}`,
    content.closing.body,
    attachmentsForSection(content, "closing"),
  );

  for (const [index, block] of content.extras.entries()) {
    // Already merged into "Standards / Learning targets" above.
    if (isLearningTargetsExtra(block.label)) continue;
    pushSection(
      sections,
      `${block.label || `Extra ${index + 1}`}${minutesSuffix(block.minutes)}`,
      block.body,
    );
  }

  const nestedKeys = new Set([
    "learningTargets",
    "agenda",
    "vocabulary",
    "entranceTicket",
    "materials",
    "opening",
    "closing",
    ...content.workTimes.map((block) => `workTime:${block.key}`),
  ]);
  const extraSectionKeys = [
    "general",
    "homework",
    "worksheets",
    "anchorCharts",
  ] as const;
  for (const key of extraSectionKeys) {
    const attachments = attachmentsForSection(content, key);
    const heading =
      key === "general"
        ? "General resources"
        : key === "homework"
          ? "Homework"
          : key === "worksheets"
            ? "Worksheets"
            : "Anchor charts";
    pushSection(sections, heading, "", attachments);
  }

  const handledKeys = new Set([...nestedKeys, ...extraSectionKeys]);
  const orphanLinks = content.lessonPlanLinks
    .filter((link) => !handledKeys.has(link.sectionKey))
    .map(toExportLink);
  const orphanImages = content.images
    .filter((img) => !handledKeys.has(img.sectionKey))
    .map(toExportImage);
  pushSection(sections, "Additional resources", "", {
    links: orphanLinks,
    images: orphanImages,
  });

  return { title, subtitle, sections };
}

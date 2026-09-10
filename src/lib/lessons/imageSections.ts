import type {
  LessonPlanContent,
  LessonPlanImage,
  LessonPlanLink,
} from "./content";

export type ImageSectionOption = {
  key: string;
  label: string;
};

/**
 * Dropdown options for where an image attaches (no drag-and-drop).
 * Order matches the lesson plan / agenda flow in the preview.
 */
export function imageSectionOptionsForContent(
  content: LessonPlanContent,
): ImageSectionOption[] {
  const options: ImageSectionOption[] = [
    { key: "general", label: "General (top of plan)" },
    { key: "learningTargets", label: "Learning Targets" },
    { key: "agenda", label: "Agenda" },
    { key: "entranceTicket", label: "Entrance Ticket" },
    { key: "vocabulary", label: "Vocabulary" },
    { key: "materials", label: "Materials" },
    { key: "opening", label: content.opening.label || "Opening" },
  ];

  for (const wt of content.workTimes) {
    options.push({
      key: `workTime:${wt.key}`,
      label: wt.label || `Work Time ${wt.key}`,
    });
  }

  options.push({
    key: "closing",
    label: content.closing.label || "Closing",
  });
  options.push({ key: "homework", label: "Homework" });
  options.push({ key: "worksheets", label: "Worksheets" });
  options.push({ key: "anchorCharts", label: "Anchor Charts" });

  return options;
}

export function imagesForSection(
  content: LessonPlanContent,
  sectionKey: string,
): LessonPlanImage[] {
  return (content.images ?? []).filter((img) => img.sectionKey === sectionKey);
}

export function linksForSection(
  content: LessonPlanContent,
  sectionKey: string,
): LessonPlanLink[] {
  return (content.lessonPlanLinks ?? []).filter(
    (link) => link.sectionKey === sectionKey,
  );
}

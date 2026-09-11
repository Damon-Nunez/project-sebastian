/**
 * District-standard classwork/homework rubric.
 * Mandated formula chrome — shown above Materials, not teacher-edited.
 * Export + editor use the fixed PNG (same pattern as Differentiation images).
 */
export const STANDARD_CLASSWORK_RUBRIC = {
  title: "General Classwork and/or Homework Rubric",
  levels: [
    {
      score: 4,
      label: "Exceeds Standards",
      headerClass: "text-emerald-700",
      criteria: [
        "Student has completed the task thoroughly, and accurately.",
        "Students display an understanding of all key concepts and ideas associated with the task.",
        "Minimal amount of spelling and mechanical errors.",
      ],
    },
    {
      score: 3,
      label: "Meets Standards",
      headerClass: "text-sky-700",
      criteria: [
        "Student completed the task.",
        "Students display an understanding of most key concepts and ideas associated with the task.",
        "Minimal amount of spelling and mechanical errors.",
      ],
    },
    {
      score: 2,
      label: "Approaching Standard",
      headerClass: "text-amber-700",
      criteria: [
        "Student completed some of the task.",
        "Student displays a vague understanding of the key concepts and ideas associated with the task.",
        "Many mechanical and spelling errors.",
      ],
    },
    {
      score: 1,
      label: "Does not meet Standard",
      headerClass: "text-rose-700",
      criteria: [
        "Work is incomplete.",
        "There is no evidence of understanding key concepts or ideas associated with the task.",
        "Too many mechanical and spelling errors.",
      ],
    },
  ],
} as const;

/** Bundled rubric graphic under /public — UI preview + PDF/DOCX embed. */
export const STANDARD_CLASSWORK_RUBRIC_IMAGE = {
  id: "standard-classwork-rubric",
  /** Browser URL (cache-bust when regenerating the PNG). */
  src: "/lessons/rubric/classwork-homework-rubric.png?v=3",
  /** Path relative to /public for server-side export reads. */
  publicPath: "lessons/rubric/classwork-homework-rubric.png",
  alt: "General Classwork and/or Homework Rubric",
  filename: "classwork-homework-rubric.png",
  mimeType: "image/png" as const,
};

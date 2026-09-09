/**
 * Best-effort M/U/L labels from framework text or filename.
 * Flexible strings — not a rigid curriculum tree.
 */

export type LessonLabels = {
  module_label: string | null;
  unit_label: string | null;
  lesson_label: string | null;
};

const emptyLabels = (): LessonLabels => ({
  module_label: null,
  unit_label: null,
  lesson_label: null,
});

/** Prefer structured lines like "Grade 8: Module 1: Unit 1: Lesson 1". */
export function guessLabelsFromText(text: string): LessonLabels {
  const head = text.slice(0, 2500);
  const structured = head.match(
    /Module\s+(\d+)\s*[:\-–—]\s*Unit\s+(\d+)\s*[:\-–—]\s*Lesson\s+(\d+)/i,
  );
  if (structured) {
    return {
      module_label: structured[1] ?? null,
      unit_label: structured[2] ?? null,
      lesson_label: structured[3] ?? null,
    };
  }

  const moduleMatch = head.match(/\bModule\s+(\d+)\b/i);
  const unitMatch = head.match(/\bUnit\s+(\d+)\b/i);
  const lessonMatch = head.match(/\bLesson\s+(\d+)\b/i);

  return {
    module_label: moduleMatch?.[1] ?? null,
    unit_label: unitMatch?.[1] ?? null,
    lesson_label: lessonMatch?.[1] ?? null,
  };
}

export function guessLabelsFromFilename(filename: string): LessonLabels {
  const base = filename.replace(/\.[^.]+$/, "");
  const lessonMatch = base.match(/L(?:esson)?[\s_-]*(\d+)/i);
  const moduleMatch = base.match(/M(?:odule)?[\s_-]*(\d+)/i);
  const unitMatch = base.match(/U(?:nit)?[\s_-]*(\d+)/i);

  return {
    module_label: moduleMatch?.[1] ?? null,
    unit_label: unitMatch?.[1] ?? null,
    lesson_label: lessonMatch?.[1] ?? null,
  };
}

export function coalesceLabels(
  fromText: LessonLabels,
  fromFilename: LessonLabels,
): LessonLabels {
  return {
    module_label: fromText.module_label ?? fromFilename.module_label,
    unit_label: fromText.unit_label ?? fromFilename.unit_label,
    lesson_label: fromText.lesson_label ?? fromFilename.lesson_label,
  };
}

export function resolveLessonLabels(input: {
  text: string;
  filename: string;
}): LessonLabels {
  return coalesceLabels(
    guessLabelsFromText(input.text),
    guessLabelsFromFilename(input.filename),
  );
}

export { emptyLabels };

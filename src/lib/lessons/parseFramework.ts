import {
  emptyLessonPlanContent,
  emptyWorkTimeBlock,
  type LessonPlanContent,
  type WorkTimeBlock,
  workTimeKeyForIndex,
} from "./content";

/**
 * Ticket 5.3 — Approach A: keyword / heading hunt.
 * Split extracted framework text into LessonPlanContent fields.
 * Alias list is easy to extend when a district renames a section.
 */

type FieldKind =
  | "standards"
  | "agenda"
  | "materials"
  | "opening"
  | "closing"
  | "workTime"
  | "extra";

type HeadingMatch = {
  kind: FieldKind;
  /** Display label preserved from the doc when useful. */
  label: string;
  /** Set for lettered Work Time headings (A, B, …). */
  workKey?: string;
};

type OpenSection =
  | { kind: "standards" | "agenda" | "materials" }
  | { kind: "opening" | "closing" }
  | { kind: "workTime"; workKey: string }
  | { kind: "extra" };

function isLikelyBodyLine(line: string): boolean {
  if (line.length > 120) return true;
  if (/^[●■◦•\-\*]/.test(line)) return true;
  if (/^(in work time|these are the standards|review the learning)/i.test(line)) {
    return true;
  }
  // Rubric row labels — not the standards formula section.
  if (/^(exceeds|meets|approaching)\s+standards?\b/i.test(line)) return true;
  if (/^does not meet\b/i.test(line)) return true;
  return false;
}

/** True when rest-after-letter is empty, bare ":", or a short timing suffix. */
function isShortWorkTimeSuffix(rest: string): boolean {
  const t = rest.trim();
  if (t === "" || t === ":") return true;
  return /^[-–—:]?\s*\d+\s*minutes?\s*:?\s*$/i.test(t);
}

/**
 * Try to classify a line as a section heading. More specific patterns first.
 * Returns null if the line is body text.
 */
export function matchFrameworkHeading(rawLine: string): HeadingMatch | null {
  const line = rawLine.trim().replace(/\s+/g, " ");
  if (!line || isLikelyBodyLine(line)) return null;

  // Work Time A / Work Time - B - 10 minutes (not "Work Time A: long checklist title")
  const lettered = line.match(/^work\s*time\s*[-–—:]?\s*([A-Za-z])\b(.*)$/i);
  if (lettered?.[1] && isShortWorkTimeSuffix(lettered[2] ?? "")) {
    const key = lettered[1].toUpperCase();
    return {
      kind: "workTime",
      label: `Work Time ${key}`,
      workKey: key,
    };
  }

  // Generic Work Time (each occurrence → next letter in the parser)
  if (/^work\s*time\s*:?\s*$/i.test(line) || /^work\s*time\s*[-–—]/i.test(line)) {
    return { kind: "workTime", label: "Work Time" };
  }

  if (
    /^opening\s*:?\s*$/i.test(line) ||
    /^\d+\.\s*opening\b/i.test(line) ||
    /^opening\s*[-–—]/i.test(line) ||
    /^opening\s+activity\b/i.test(line) ||
    /^entry\s*ticket\b/i.test(line)
  ) {
    const label = /^entry\s*ticket/i.test(line) ? "Entry Ticket" : "Opening";
    return { kind: "opening", label };
  }

  if (
    /^closing(\s+and\s+assessment)?\s*:?\s*$/i.test(line) ||
    /^\d+\.\s*closing\b/i.test(line) ||
    /^closing\s*[-–—:]/i.test(line) ||
    /^exit\s*ticket\b/i.test(line)
  ) {
    const label = /^exit\s*ticket/i.test(line)
      ? "Exit Ticket"
      : /assessment/i.test(line)
        ? "Closing and Assessment"
        : "Closing";
    return { kind: "closing", label };
  }

  if (
    /^(ccs|ccss)\s+standards?\s*$/i.test(line) ||
    /^focus\s+standards?\s*$/i.test(line) ||
    /^standards?\s*:?\s*$/i.test(line)
  ) {
    return { kind: "standards", label: line.replace(/:$/, "") };
  }

  if (/^agenda\s*:?\s*$/i.test(line)) {
    return { kind: "agenda", label: "Agenda" };
  }

  if (
    /^materials(\s+and\s+preparation)?\s*:?\s*$/i.test(line) ||
    /^supporting\s+materials\b/i.test(line)
  ) {
    return {
      kind: "materials",
      label: /preparation/i.test(line)
        ? "Materials and Preparation"
        : "Materials",
    };
  }

  if (
    /^(lesson\s+overview|lesson\s+summary|daily\s+learning\s+targets|learning\s+targets|homework)\s*:?\s*$/i.test(
      line,
    )
  ) {
    return { kind: "extra", label: line.replace(/:$/, "") };
  }

  return null;
}

function appendLine(existing: string, line: string): string {
  return existing ? `${existing}\n${line}` : line;
}

function finalizeWorkTimes(
  byKey: Map<string, WorkTimeBlock>,
): WorkTimeBlock[] {
  if (byKey.size === 0) {
    return [emptyWorkTimeBlock(0), emptyWorkTimeBlock(1)];
  }

  const keys = [...byKey.keys()].sort();
  return keys.map((key, index) => {
    const block = byKey.get(key)!;
    const normalizedKey = workTimeKeyForIndex(index);
    return {
      key: normalizedKey,
      label: block.label || `Work Time ${normalizedKey}`,
      minutes: block.minutes ?? null,
      body: block.body.trim(),
    };
  });
}

/** While listing the Agenda, nested Opening/Work Time/Closing are outline lines. */
function isAgendaOutlineHeading(heading: HeadingMatch): boolean {
  return (
    heading.kind === "opening" ||
    heading.kind === "workTime" ||
    heading.kind === "closing" ||
    heading.kind === "extra"
  );
}

/** Materials checklists often name Work Time items — keep those in materials. */
function isMaterialsOutlineHeading(heading: HeadingMatch): boolean {
  return heading.kind === "workTime";
}

/**
 * Parse plain framework text into Approach A lesson content.
 */
export function parseFrameworkText(text: string): LessonPlanContent {
  const content = emptyLessonPlanContent({ workTimeCount: 0 });
  const workByKey = new Map<string, WorkTimeBlock>();
  let open: OpenSection | null = null;

  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const heading = matchFrameworkHeading(trimmed);

    if (heading && open?.kind === "agenda" && isAgendaOutlineHeading(heading)) {
      content.agenda = appendLine(content.agenda, trimmed);
      continue;
    }

    if (
      heading &&
      open?.kind === "materials" &&
      isMaterialsOutlineHeading(heading)
    ) {
      content.materials = appendLine(content.materials, trimmed);
      continue;
    }

    if (heading) {
      if (heading.kind === "workTime") {
        const key =
          heading.workKey ?? workTimeKeyForIndex(workByKey.size);
        if (!workByKey.has(key)) {
          workByKey.set(key, {
            key,
            label: heading.workKey
              ? heading.label
              : `Work Time ${key}`,
            minutes: null,
            body: "",
          });
        } else if (heading.workKey) {
          workByKey.get(key)!.label = heading.label;
        }
        open = { kind: "workTime", workKey: key };
        continue;
      }

      if (heading.kind === "opening") {
        content.opening.label = heading.label;
        open = { kind: "opening" };
        continue;
      }
      if (heading.kind === "closing") {
        content.closing.label = heading.label;
        open = { kind: "closing" };
        continue;
      }
      if (heading.kind === "standards") {
        open = { kind: "standards" };
        continue;
      }
      if (heading.kind === "agenda") {
        open = { kind: "agenda" };
        continue;
      }
      if (heading.kind === "materials") {
        open = { kind: "materials" };
        continue;
      }
      if (heading.kind === "extra") {
        content.extras.push({ label: heading.label, body: "", minutes: null });
        open = { kind: "extra" };
        continue;
      }
    }

    if (!open) continue;

    if (open.kind === "standards") {
      content.standards = appendLine(content.standards, trimmed);
    } else if (open.kind === "agenda") {
      content.agenda = appendLine(content.agenda, trimmed);
    } else if (open.kind === "materials") {
      content.materials = appendLine(content.materials, trimmed);
    } else if (open.kind === "opening") {
      content.opening.body = appendLine(content.opening.body, trimmed);
    } else if (open.kind === "closing") {
      content.closing.body = appendLine(content.closing.body, trimmed);
    } else if (open.kind === "workTime") {
      const block = workByKey.get(open.workKey);
      if (block) block.body = appendLine(block.body, trimmed);
    } else if (open.kind === "extra") {
      const last = content.extras[content.extras.length - 1];
      if (last) last.body = appendLine(last.body, trimmed);
    }
  }

  content.workTimes = finalizeWorkTimes(workByKey);
  content.standards = content.standards.trim();
  content.agenda = content.agenda.trim();
  content.materials = content.materials.trim();
  content.opening.body = content.opening.body.trim();
  content.closing.body = content.closing.body.trim();
  content.extras = content.extras.map((e) => ({
    ...e,
    body: e.body.trim(),
  }));

  return content;
}

/**
 * AI grading, text path (Ticket 10 / SCRUM-130).
 * Claim a pending suggestion → sanitize key + rubric + work + notes →
 * Claude judges each question → our code computes the range → save.
 */
import { createAiMessage, createAiVisionMessage } from "@/lib/ai/createAiMessage";
import { DEFAULT_AI_MODEL } from "@/lib/ai/getAiClient";
import { extractJsonObject, messageText } from "@/lib/ai/parseLlmJson";
import type {
  AssignmentRow,
  GradingSuggestionRow,
  ReferenceKind,
  RubricRow,
} from "@/lib/db/types";
import { getAssignmentForTeacher } from "@/lib/grading/assignments";
import { SUGGESTION_SELECT } from "@/lib/grading/fileHomework";
import { getGradingSessionForTeacher } from "@/lib/grading/sessions";
import { getStudentWorkForTeacher } from "@/lib/grading/upload";
import { listStudentsForTeacher } from "@/lib/roster/students";
import {
  parseRubricCriteria,
  type RubricCriteria,
} from "@/lib/rubrics/criteria";
import { prepareTextForAi, rehydrate } from "@/lib/sanitizer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  AI_GRADE_JSON_SHAPE,
  aiGradeSchema,
  rubricIssues,
  type AiGrade,
} from "./gradeSchema";
import { computeGrade, type ComputedGrade } from "./score";
import { parseVisionPages } from "./studentWorkFiles";
import { loadMaskedPages, type MaskedPageImage } from "./vision";

/** A "grading" claim older than this is treated as abandoned (tab closed mid-call). */
const STALE_CLAIM_MS = 5 * 60 * 1000;
const MAX_STUDENT_TEXT_CHARS = 30_000;
const MAX_ATTEMPTS = 2;

const SYSTEM_PROMPT = `You grade middle-school English homework for a teacher in Sebastian. The teacher makes the final call; you give per-question judgments she can check.

Privacy: student names are replaced with placeholders like [STUDENT_1]. Never guess or invent names. Do not address the student by name.

Formatting markers in the student's work and in the reference:
- [[hl]]…[[/hl]] highlighted, [[b]]…[[/b]] bold, [[u]]…[[/u]] underlined, [[s]]…[[/s]] struck through.
- On multiple choice, a highlighted, bolded or underlined option (or a typed letter) is usually the student's choice; struck-through options are rejected. If you cannot tell which option was chosen (e.g. two options marked), the verdict is "unreadable".
- In the reference, the same markers usually mark the correct answer.

How to grade:
1. Find each question in the reference (numbering like "1.", "Q1", "a)"). Match the student's answers by number first, then by content when numbering is missing or shifted. A reference question the student skipped is "unanswered".
2. kind "key": the reference gives a specific correct answer (multiple choice, vocabulary, fill-in, short answer with an expected point). kind "rubric": the question asks for an extended written response (paragraph, RACE/ACE, explain in detail) — give rubricLevel on the rubric's level scores.
3. Key verdicts: judge meaning, not wording; accept equivalent answers. "partial" = right idea but incomplete or missing evidence. Every partial reason must say exactly what earned the half point and what was missing (e.g. "½ — correct claim, but no quote from the text").
4. maxPoints: only when the reference explicitly states points for that question. Otherwise null. Never invent points.
5. With an example (exemplar) instead of a key, or no reference: list the questions you can identify in the student's work as items when it helps explain the grade (verdict null, kind "rubric" with a rubricLevel), or leave items empty.
6. categoryScores: score the whole paper on every rubric category using the rubric's level scores and descriptors.
7. Accommodation notes (if given): apply them (e.g. leniency on spelling for a documented need), set accommodationConsidered true and say how in accommodationNote. Notes never lower a grade.
8. comment: 2–4 specific sentences for the teacher, using the rubric's language.
9. Do not compute an overall percent or grade.

Return ONLY valid JSON matching this shape (no markdown fences, no commentary):
${AI_GRADE_JSON_SHAPE}`;

const VISION_RULES = `

The student's work is in the attached page images (photos or scans of paper), in page order.
- Solid black boxes are privacy masks over names. Ignore them; never guess what is under them.
- Multiple choice: a circled, filled-in, checked or underlined option is the student's choice. An option crossed out or erased is rejected.
- If two options are marked, the mark is too faint to see, or the handwriting cannot be read, the verdict is "unreadable" — never guess.
- studentAnswer: transcribe what you can read; write "[illegible]" for parts you cannot.`;

export type GradeDetail = {
  version: 1;
  mode: ComputedGrade["mode"];
  percent: number;
  earnedPoints: number | null;
  totalPoints: number | null;
  referenceKind: ReferenceKind;
  items: AiGrade["items"];
  categoryScores: AiGrade["categoryScores"];
  accommodationNote: string | null;
  model: string;
  /** Graded from masked page images rather than extracted text. */
  fromImages?: boolean;
};

export type GradeOutcome = "graded" | "failed" | "needs_vision" | "skipped";

function describeRubric(criteria: RubricCriteria): string {
  const levels = [...criteria.levels].sort((a, b) => b.score - a.score);
  return criteria.categories
    .map((category) => {
      const lines = levels.map((level) => {
        const cell = criteria.cells.find(
          (c) => c.categoryId === category.id && c.levelId === level.id,
        );
        const label = level.label ? ` (${level.label})` : "";
        return `  - ${level.score}${label}: ${cell?.description || "—"}`;
      });
      return `Category id "${category.id}" — ${category.name}\n${lines.join("\n")}`;
    })
    .join("\n");
}

function referenceSection(
  assignment: Pick<AssignmentRow, "reference_kind" | "reference_text">,
): string {
  const text = assignment.reference_text?.trim();
  if (assignment.reference_kind === "answer_key" && text) {
    return `---ANSWER KEY---\n${text}\n---END ANSWER KEY---`;
  }
  if (assignment.reference_kind === "exemplar" && text) {
    return `---EXAMPLE OF STRONG WORK (compare quality; not an answer key)---\n${text}\n---END EXAMPLE---`;
  }
  return "No answer key or example for this assignment — grade on the rubric only.";
}

/** Unsanitized prompt — always pass through `askForGrade`, which sanitizes. */
export function buildGradingPrompt(input: {
  assignment: Pick<AssignmentRow, "assignment_type" | "reference_kind" | "reference_text">;
  criteria: RubricCriteria;
  notes: string | null;
  /** Null when the work is sent as page images instead. */
  studentText: string | null;
  pageCount?: number;
}): string {
  const { criteria } = input;
  const studentWork =
    input.studentText === null
      ? `The student's work is in the ${input.pageCount ?? 1} attached page image(s).`
      : input.studentText.slice(0, MAX_STUDENT_TEXT_CHARS);
  return [
    `Assignment type: ${input.assignment.assignment_type}`,
    `---RUBRIC (level scores ${criteria.scale.min}–${criteria.scale.max})---\n${describeRubric(criteria)}\n---END RUBRIC---`,
    referenceSection(input.assignment),
    input.notes
      ? `---ACCOMMODATION NOTES (teacher's notes on this student)---\n${input.notes}\n---END NOTES---`
      : "No accommodation notes for this student.",
    `---STUDENT WORK---\n${studentWork}\n---END STUDENT WORK---`,
  ].join("\n\n");
}

async function claimSuggestion(input: {
  teacherId: string;
  suggestionId: string;
}): Promise<GradingSuggestionRow | null> {
  const admin = createAdminSupabaseClient();
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data, error } = await admin
    .from("grading_suggestions")
    .update({ ai_status: "grading", updated_at: new Date().toISOString() })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.suggestionId)
    .or(
      `ai_status.eq.pending,and(ai_status.eq.grading,updated_at.lt."${staleBefore}")`,
    )
    .select(SUGGESTION_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to claim grading: ${error.message}`);
  }
  return (data as GradingSuggestionRow | null) ?? null;
}

async function saveSuggestion(
  teacherId: string,
  suggestionId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("grading_suggestions")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("teacher_id", teacherId)
    .eq("id", suggestionId);
  if (error) {
    throw new Error(`Failed to save grading result: ${error.message}`);
  }
}

export async function loadRubric(
  teacherId: string,
  rubricId: string,
): Promise<RubricRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("rubrics")
    .select("id, teacher_id, kind, name, criteria, unit_id, section_id, created_at, updated_at")
    .eq("teacher_id", teacherId)
    .eq("id", rubricId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load rubric: ${error.message}`);
  return (data as RubricRow | null) ?? null;
}

export async function askForGrade(input: {
  teacherId: string;
  userPrompt: string;
  roster: Parameters<typeof prepareTextForAi>[1];
  criteria: RubricCriteria;
  pages?: MaskedPageImage[];
}): Promise<{ grade: AiGrade; map: ReturnType<typeof prepareTextForAi>["map"] }> {
  const prepared = prepareTextForAi(input.userPrompt, input.roster);
  // Smoke proof in the server terminal: outbound AI text never contains roster names.
  const sharedHits =
    prepared.sanitizedText.match(/\[\[STU_SHARED\]\]/g)?.length ?? 0;
  const studentHits =
    prepared.sanitizedText.match(/\[\[STU_[0-9a-f-]+\]\]/gi)?.length ?? 0;
  console.info("[grading-sanitize] outbound AI prompt (redacted)", {
    sharedPlaceholderCount: sharedHits,
    studentTokenCount: studentHits,
    preview: prepared.sanitizedText.slice(0, 800),
  });
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const message = input.pages?.length
        ? await createAiVisionMessage(input.teacherId, prepared, input.pages, {
            system: SYSTEM_PROMPT + VISION_RULES,
            model: DEFAULT_AI_MODEL,
            maxTokens: 4096,
          })
        : await createAiMessage(input.teacherId, prepared, {
            system: SYSTEM_PROMPT,
            model: DEFAULT_AI_MODEL,
            maxTokens: 4096,
          });
      const raw = messageText(message.content as { type: string; text?: string }[]);
      const grade = aiGradeSchema.parse(extractJsonObject(raw));
      const issues = rubricIssues(grade, input.criteria);
      if (issues.length > 0) {
        throw new Error(`AI grade off-rubric: ${issues.join("; ")}`);
      }
      return { grade, map: prepared.map };
    } catch (error) {
      lastError = error;
      console.error(`AI grading attempt ${attempt} failed`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI grading failed");
}

function rehydrateGrade(grade: AiGrade, back: (text: string) => string): AiGrade {
  return {
    ...grade,
    items: grade.items.map((item) => ({
      ...item,
      studentAnswer: back(item.studentAnswer),
      expectedAnswer: item.expectedAnswer === null ? null : back(item.expectedAnswer),
      reason: back(item.reason),
    })),
    categoryScores: grade.categoryScores.map((score) => ({
      ...score,
      reason: back(score.reason),
    })),
    comment: back(grade.comment),
    accommodationNote:
      grade.accommodationNote === null ? null : back(grade.accommodationNote),
  };
}

/**
 * Grade one filed paper. Returns "skipped" when another tab already claimed it
 * or it isn't pending. Never throws for grading failures — it records them.
 */
export async function gradeSuggestion(input: {
  teacherId: string;
  suggestionId: string;
}): Promise<GradeOutcome> {
  const suggestion = await claimSuggestion(input);
  if (!suggestion) return "skipped";

  try {
    const [document, session, roster] = await Promise.all([
      suggestion.document_id
        ? getStudentWorkForTeacher({
            teacherId: input.teacherId,
            documentId: suggestion.document_id,
          })
        : null,
      getGradingSessionForTeacher({
        teacherId: input.teacherId,
        sessionId: suggestion.grading_session_id,
      }),
      listStudentsForTeacher(input.teacherId),
    ]);
    if (!document || !session) throw new Error("Paper or folder not found");

    const visionPages = document.needs_vision
      ? parseVisionPages(document.vision_pages)
      : [];
    const gradable = document.needs_vision
      ? visionPages.length > 0
      : Boolean(document.body_text?.trim());
    if (!gradable) {
      await saveSuggestion(input.teacherId, suggestion.id, { ai_status: "needs_vision" });
      return "needs_vision";
    }

    const [assignment, rubric] = await Promise.all([
      session.assignment_id
        ? getAssignmentForTeacher({
            teacherId: input.teacherId,
            assignmentId: session.assignment_id,
          })
        : null,
      loadRubric(input.teacherId, session.rubric_id),
    ]);
    if (!assignment) throw new Error("Assignment not found for folder");
    if (!rubric) throw new Error("Rubric not found for folder");
    const criteria = parseRubricCriteria(rubric.criteria);

    const notes = roster.find((s) => s.id === suggestion.student_id)?.notes?.trim();
    const userPrompt = buildGradingPrompt({
      assignment,
      criteria,
      notes: notes || null,
      studentText: document.needs_vision ? null : document.body_text,
      pageCount: visionPages.length,
    });

    const { grade, map } = await askForGrade({
      teacherId: input.teacherId,
      userPrompt,
      roster: roster.map((s) => ({ id: s.id, name: s.name, nickname: s.nickname })),
      criteria,
      pages: visionPages.length > 0 ? await loadMaskedPages(visionPages) : undefined,
    });
    const shown = rehydrateGrade(grade, (text) => rehydrate(text, map));
    const computed = computeGrade({
      grade: shown,
      criteria,
      hasReference: assignment.reference_kind !== "none",
    });

    const detail: GradeDetail = {
      version: 1,
      mode: computed.mode,
      percent: computed.percent,
      earnedPoints: computed.earnedPoints,
      totalPoints: computed.totalPoints,
      referenceKind: assignment.reference_kind,
      items: shown.items,
      categoryScores: shown.categoryScores,
      accommodationNote: shown.accommodationNote,
      model: DEFAULT_AI_MODEL,
      fromImages: visionPages.length > 0,
    };

    await saveSuggestion(input.teacherId, suggestion.id, {
      ai_status: "graded",
      suggested_range_low: computed.rangeLow,
      suggested_range_high: computed.rangeHigh,
      suggested_comment: shown.comment,
      accommodation_flagged: Boolean(notes) && shown.accommodationConsidered,
      grading_detail: detail,
      graded_reference_at: assignment.reference_updated_at,
    });
    return "graded";
  } catch (error) {
    console.error("gradeSuggestion failed", error);
    await saveSuggestion(input.teacherId, suggestion.id, { ai_status: "failed" }).catch(
      (saveError) => console.error("Failed to mark grading failed", saveError),
    );
    return "failed";
  }
}

/** Suggestions under this assignment waiting for (or abandoned mid-) grading. */
export async function listGradingQueueForAssignment(input: {
  teacherId: string;
  assignmentId: string;
}): Promise<{ pendingIds: string[]; failedIds: string[]; awaitingApproval: number }> {
  const admin = createAdminSupabaseClient();
  const staleBefore = Date.now() - STALE_CLAIM_MS;
  const { data, error } = await admin
    .from("grading_suggestions")
    .select("id, ai_status, updated_at, grading_sessions!inner(assignment_id)")
    .eq("teacher_id", input.teacherId)
    .eq("grading_sessions.assignment_id", input.assignmentId)
    .in("ai_status", ["pending", "grading", "failed", "awaiting_approval"]);

  if (error) {
    throw new Error(`Failed to list grading queue: ${error.message}`);
  }

  const pendingIds: string[] = [];
  const failedIds: string[] = [];
  let awaitingApproval = 0;
  for (const row of data ?? []) {
    const id = row.id as string;
    if (row.ai_status === "awaiting_approval") awaitingApproval += 1;
    else if (row.ai_status === "failed") failedIds.push(id);
    else if (
      row.ai_status === "pending" ||
      Date.parse(row.updated_at as string) < staleBefore
    ) {
      pendingIds.push(id);
    }
  }
  return { pendingIds, failedIds, awaitingApproval };
}

/**
 * Teacher checked the masked preview: send it to the grader, or keep it off
 * the AI and grade by hand. Only papers still awaiting approval move.
 */
export async function decideVisionApproval(input: {
  teacherId: string;
  suggestionId: string;
  approve: boolean;
}): Promise<boolean> {
  const { data, error } = await createAdminSupabaseClient()
    .from("grading_suggestions")
    .update({
      ai_status: input.approve ? "pending" : "manual",
      updated_at: new Date().toISOString(),
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.suggestionId)
    .eq("ai_status", "awaiting_approval")
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to save approval: ${error.message}`);
  }
  return data !== null;
}

/** Put failed papers back in the queue. */
export async function requeueFailedGrading(input: {
  teacherId: string;
  suggestionIds: string[];
}): Promise<void> {
  if (input.suggestionIds.length === 0) return;
  await createAdminSupabaseClient()
    .from("grading_suggestions")
    .update({ ai_status: "pending", updated_at: new Date().toISOString() })
    .eq("teacher_id", input.teacherId)
    .eq("ai_status", "failed")
    .in("id", input.suggestionIds)
    .throwOnError();
}

import type { DocumentRow, LessonPlanRow } from "@/lib/db/types";
import { isAnthropicConfigured } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { parseLessonPlanContent, type LessonPlanContent } from "./content";
import {
  detectFrameworkFormat,
  extractFrameworkText,
  UnsupportedFrameworkFormatError,
} from "./extract";
import { resolveLessonLabels } from "./labels";
import { bucketsToLessonPlanContent } from "./llmBuckets";
import { parseFrameworkText } from "./parseFramework";
import { parseFrameworkWithLlm } from "./parseFrameworkLlm";

const PLAN_SELECT =
  "id, teacher_id, module_label, unit_label, lesson_label, content, section_groups, free_text_asks, status, drive_file_id, created_at, updated_at";

const DOCUMENT_SELECT =
  "id, teacher_id, kind, original_filename, storage_path, lesson_plan_id, grading_session_id, created_at, updated_at";

const MAX_FRAMEWORK_BYTES = 20 * 1024 * 1024;

export type FrameworkUploadResult = {
  plan: LessonPlanRow;
  document: DocumentRow;
  content: LessonPlanContent;
};

function asPlanRow(data: Record<string, unknown>): LessonPlanRow {
  return {
    ...(data as Omit<LessonPlanRow, "content">),
    content: data.content,
  };
}

export async function listLessonPlansForTeacher(
  teacherId: string,
): Promise<LessonPlanRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lesson_plans")
    .select(PLAN_SELECT)
    .eq("teacher_id", teacherId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list lesson plans: ${error.message}`);
  }

  return (data ?? []).map((row) => asPlanRow(row as Record<string, unknown>));
}

export async function getLessonPlanForTeacher(
  teacherId: string,
  lessonPlanId: string,
): Promise<LessonPlanRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lesson_plans")
    .select(PLAN_SELECT)
    .eq("teacher_id", teacherId)
    .eq("id", lessonPlanId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load lesson plan: ${error.message}`);
  }

  return data ? asPlanRow(data as Record<string, unknown>) : null;
}

/**
 * Prefer schema-constrained LLM bucket sort; fall back to keyword parse
 * when Anthropic is unset or the LLM call/validation fails.
 */
async function parseFrameworkContentForUpload(input: {
  teacherId: string;
  filename: string;
  text: string;
}): Promise<LessonPlanContent> {
  if (!isAnthropicConfigured()) {
    return parseFrameworkText(input.text);
  }

  try {
    const { buckets } = await parseFrameworkWithLlm({
      text: input.text,
      teacherId: input.teacherId,
      filename: input.filename,
    });
    return bucketsToLessonPlanContent(buckets);
  } catch (error) {
    console.error(
      "LLM framework parse failed; falling back to keyword parse",
      error,
    );
    return parseFrameworkText(input.text);
  }
}

/**
 * Extract + parse a framework upload, then create a draft lesson_plans row
 * and a documents metadata row (storage_path left null for V1).
 */
export async function createLessonPlanFromFrameworkUpload(input: {
  teacherId: string;
  filename: string;
  bytes: Buffer | Uint8Array;
}): Promise<FrameworkUploadResult> {
  if (!detectFrameworkFormat(input.filename)) {
    throw new UnsupportedFrameworkFormatError(input.filename);
  }

  const byteLength = input.bytes.byteLength;
  if (byteLength === 0) {
    throw new Error("Uploaded file is empty");
  }
  if (byteLength > MAX_FRAMEWORK_BYTES) {
    throw new Error("File is too large (max 20MB)");
  }

  const extracted = await extractFrameworkText({
    buffer: input.bytes,
    filename: input.filename,
  });
  const content = await parseFrameworkContentForUpload({
    teacherId: input.teacherId,
    filename: input.filename,
    text: extracted.text,
  });
  // M/U/L from text+filename regex (more reliable than LLM titles).
  const labels = resolveLessonLabels({
    text: extracted.text,
    filename: input.filename,
  });

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: planData, error: planError } = await admin
    .from("lesson_plans")
    .insert({
      teacher_id: input.teacherId,
      module_label: labels.module_label,
      unit_label: labels.unit_label,
      lesson_label: labels.lesson_label,
      content,
      section_groups: {},
      free_text_asks: null,
      status: "draft",
      updated_at: now,
    })
    .select(PLAN_SELECT)
    .single();

  if (planError || !planData) {
    throw new Error(
      `Failed to create lesson plan: ${planError?.message ?? "unknown error"}`,
    );
  }

  const plan = asPlanRow(planData as Record<string, unknown>);

  const { data: docData, error: docError } = await admin
    .from("documents")
    .insert({
      teacher_id: input.teacherId,
      kind: "framework",
      original_filename: input.filename,
      storage_path: null,
      lesson_plan_id: plan.id,
      updated_at: now,
    })
    .select(DOCUMENT_SELECT)
    .single();

  if (docError || !docData) {
    // Best-effort cleanup so we don't leave orphan drafts without a source doc.
    await admin.from("lesson_plans").delete().eq("id", plan.id);
    throw new Error(
      `Failed to save document metadata: ${docError?.message ?? "unknown error"}`,
    );
  }

  return {
    plan,
    document: docData as DocumentRow,
    content: parseLessonPlanContent(plan.content),
  };
}

export async function updateLessonPlanContent(input: {
  teacherId: string;
  lessonPlanId: string;
  content: LessonPlanContent;
  freeTextAsks?: string | null;
  moduleLabel?: string | null;
  unitLabel?: string | null;
  lessonLabel?: string | null;
}): Promise<LessonPlanRow> {
  const content = parseLessonPlanContent(input.content);
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    content,
    updated_at: now,
  };
  if (input.freeTextAsks !== undefined) {
    const trimmed = (input.freeTextAsks ?? "").trim();
    patch.free_text_asks = trimmed.length > 0 ? trimmed : null;
  }
  if (input.moduleLabel !== undefined) {
    const trimmed = (input.moduleLabel ?? "").trim();
    patch.module_label = trimmed.length > 0 ? trimmed : null;
  }
  if (input.unitLabel !== undefined) {
    const trimmed = (input.unitLabel ?? "").trim();
    patch.unit_label = trimmed.length > 0 ? trimmed : null;
  }
  if (input.lessonLabel !== undefined) {
    const trimmed = (input.lessonLabel ?? "").trim();
    patch.lesson_label = trimmed.length > 0 ? trimmed : null;
  }

  const { data, error } = await admin
    .from("lesson_plans")
    .update(patch)
    .eq("teacher_id", input.teacherId)
    .eq("id", input.lessonPlanId)
    .select(PLAN_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update lesson plan: ${error.message}`);
  }
  if (!data) {
    throw new Error("Lesson plan not found");
  }

  return asPlanRow(data as Record<string, unknown>);
}

/**
 * Delete a lesson plan owned by the teacher, plus linked document rows.
 * Documents FK is ON DELETE SET NULL — we remove them explicitly.
 */
export async function deleteLessonPlanForTeacher(
  teacherId: string,
  lessonPlanId: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();

  const { data: existing, error: lookupError } = await admin
    .from("lesson_plans")
    .select("id, content")
    .eq("teacher_id", teacherId)
    .eq("id", lessonPlanId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up lesson plan: ${lookupError.message}`);
  }
  if (!existing) {
    throw new Error("Lesson plan not found");
  }

  const { deleteAllLessonPlanImages } = await import("./images");
  await deleteAllLessonPlanImages({
    teacherId,
    lessonPlanId,
    content: (existing as { content: unknown }).content,
  });

  const { deleteAllLessonWorksheets } = await import("./worksheets");
  await deleteAllLessonWorksheets({ teacherId, lessonPlanId });

  const { error: docsError } = await admin
    .from("documents")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("lesson_plan_id", lessonPlanId);

  if (docsError) {
    throw new Error(`Failed to delete linked documents: ${docsError.message}`);
  }

  const { error: planError } = await admin
    .from("lesson_plans")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("id", lessonPlanId);

  if (planError) {
    throw new Error(`Failed to delete lesson plan: ${planError.message}`);
  }
}

export { MAX_FRAMEWORK_BYTES };

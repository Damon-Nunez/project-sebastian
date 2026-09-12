/**
 * Lesson worksheet uploads — stored in `lesson_worksheets` + Storage.
 * Same file types as plan images; no section attachment (always under Worksheets).
 */
import { randomUUID } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { LessonWorksheetRow } from "@/lib/db/types";
import {
  isAllowedLessonImageMime,
  extensionFor,
  LESSON_PLAN_IMAGES_BUCKET,
  MAX_LESSON_IMAGE_BYTES,
} from "./images";

const WORKSHEET_SELECT =
  "id, teacher_id, lesson_plan_id, original_filename, storage_path, mime_type, caption, created_at, updated_at";

function asWorksheetRow(data: Record<string, unknown>): LessonWorksheetRow {
  return data as LessonWorksheetRow;
}

export async function listLessonWorksheets(input: {
  teacherId: string;
  lessonPlanId: string;
}): Promise<LessonWorksheetRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lesson_worksheets")
    .select(WORKSHEET_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("lesson_plan_id", input.lessonPlanId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list worksheets: ${error.message}`);
  }
  return (data ?? []).map((row) => asWorksheetRow(row as Record<string, unknown>));
}

export async function createSignedWorksheetUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from(LESSON_PLAN_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.error("createSignedWorksheetUrl failed", error);
    return null;
  }
  return data.signedUrl;
}

export async function signLessonWorksheets(
  rows: LessonWorksheetRow[],
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (const row of rows) {
    const url = await createSignedWorksheetUrl(row.storage_path);
    if (url) urls[row.id] = url;
  }
  return urls;
}


export async function uploadLessonWorksheet(input: {
  teacherId: string;
  lessonPlanId: string;
  filename: string;
  mimeType: string;
  bytes: Buffer | Uint8Array;
  caption?: string;
}): Promise<{ row: LessonWorksheetRow; signedUrl: string | null }> {
  const mime = input.mimeType.toLowerCase();
  if (!isAllowedLessonImageMime(mime)) {
    throw new Error("Unsupported worksheet type. Use PNG, JPEG, WebP, or GIF.");
  }
  if (input.bytes.byteLength === 0) {
    throw new Error("Uploaded worksheet is empty");
  }
  if (input.bytes.byteLength > MAX_LESSON_IMAGE_BYTES) {
    throw new Error("Worksheet is too large (max 5MB)");
  }

  const admin = createAdminSupabaseClient();
  const { data: plan, error: planError } = await admin
    .from("lesson_plans")
    .select("id")
    .eq("teacher_id", input.teacherId)
    .eq("id", input.lessonPlanId)
    .maybeSingle();

  if (planError) {
    throw new Error(`Failed to verify lesson plan: ${planError.message}`);
  }
  if (!plan) {
    throw new Error("Lesson plan not found");
  }

  const id = randomUUID();
  const ext = extensionFor(mime, input.filename);
  const storagePath = `${input.teacherId}/${input.lessonPlanId}/worksheets/${id}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(LESSON_PLAN_IMAGES_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: mime === "image/jpg" ? "image/jpeg" : mime,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Worksheet upload failed: ${uploadError.message}`);
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("lesson_worksheets")
    .insert({
      id,
      teacher_id: input.teacherId,
      lesson_plan_id: input.lessonPlanId,
      original_filename: input.filename || `worksheet.${ext}`,
      storage_path: storagePath,
      mime_type: mime === "image/jpg" ? "image/jpeg" : mime,
      caption: (input.caption ?? "").trim(),
      created_at: now,
      updated_at: now,
    })
    .select(WORKSHEET_SELECT)
    .single();

  if (error || !data) {
    await admin.storage.from(LESSON_PLAN_IMAGES_BUCKET).remove([storagePath]);
    throw new Error(
      `Failed to save worksheet row: ${error?.message ?? "unknown error"}`,
    );
  }

  const row = asWorksheetRow(data as Record<string, unknown>);
  const signedUrl = await createSignedWorksheetUrl(storagePath);
  return { row, signedUrl };
}

export async function removeLessonWorksheet(input: {
  teacherId: string;
  lessonPlanId: string;
  worksheetId: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lesson_worksheets")
    .select(WORKSHEET_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("lesson_plan_id", input.lessonPlanId)
    .eq("id", input.worksheetId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up worksheet: ${error.message}`);
  }
  if (!data) {
    throw new Error("Worksheet not found");
  }

  const row = asWorksheetRow(data as Record<string, unknown>);
  const { error: removeError } = await admin.storage
    .from(LESSON_PLAN_IMAGES_BUCKET)
    .remove([row.storage_path]);
  if (removeError) {
    console.error("Failed to delete worksheet from storage", removeError);
  }

  const { error: deleteError } = await admin
    .from("lesson_worksheets")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("lesson_plan_id", input.lessonPlanId)
    .eq("id", input.worksheetId);

  if (deleteError) {
    throw new Error(`Failed to delete worksheet: ${deleteError.message}`);
  }
}

export async function deleteAllLessonWorksheets(input: {
  teacherId: string;
  lessonPlanId: string;
}): Promise<void> {
  const rows = await listLessonWorksheets(input);
  if (rows.length === 0) return;

  const admin = createAdminSupabaseClient();
  const paths = rows.map((r) => r.storage_path);
  const { error: storageError } = await admin.storage
    .from(LESSON_PLAN_IMAGES_BUCKET)
    .remove(paths);
  if (storageError) {
    console.error("deleteAllLessonWorksheets storage failed", storageError);
  }

  const { error } = await admin
    .from("lesson_worksheets")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("lesson_plan_id", input.lessonPlanId);

  if (error) {
    console.error("deleteAllLessonWorksheets rows failed", error);
  }
}

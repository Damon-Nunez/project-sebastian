"use client";

import { requestHomeworkUploadAction } from "@/app/grading/actions";
import type { GradingErrorCode } from "@/lib/grading/errors";
import { STUDENT_WORK_BUCKET } from "@/lib/grading/studentWorkFiles";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/**
 * Send a file straight from the browser to the private student-work bucket
 * via a one-time signed URL (bypasses the Vercel request body limit).
 */
export async function uploadFileToStudentWork(
  file: File,
): Promise<{ ok: true; storagePath: string } | { ok: false; code: GradingErrorCode }> {
  const target = await requestHomeworkUploadAction({
    filename: file.name,
    size: file.size,
  });
  if (!target.ok) return target;

  const { error } = await createBrowserSupabaseClient()
    .storage.from(STUDENT_WORK_BUCKET)
    .uploadToSignedUrl(target.storagePath, target.token, file, {
      contentType: file.type || "application/octet-stream",
    });
  if (error) {
    console.error("Upload to storage failed", error);
    return { ok: false, code: "upload_failed" };
  }

  return { ok: true, storagePath: target.storagePath };
}

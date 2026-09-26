"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { finalizeHomeworkUploadAction } from "@/app/grading/actions";
import { gradingErrorMessage } from "@/lib/grading/errors";
import { HOMEWORK_ACCEPT } from "@/lib/grading/studentWorkFiles";
import { uploadFileToStudentWork } from "@/lib/grading/uploadClient";

const buttonClass =
  "w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70";

type Phase = "idle" | "uploading" | "matching";

export function HomeworkUploadForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = phase !== "idle";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError(gradingErrorMessage("missing_file"));
      return;
    }

    setError(null);
    setPhase("uploading");
    try {
      await uploadAndFinalize(file);
    } catch (err) {
      console.error("Homework upload failed", err);
      setError(gradingErrorMessage("upload_failed"));
      setPhase("idle");
    }
  }

  async function uploadAndFinalize(file: File) {
    const target = await uploadFileToStudentWork(file);
    if (!target.ok) {
      setError(gradingErrorMessage(target.code));
      setPhase("idle");
      return;
    }

    setPhase("matching");
    const result = await finalizeHomeworkUploadAction({
      storagePath: target.storagePath,
      filename: file.name,
    });
    if (!result.ok) {
      setError(gradingErrorMessage(result.code));
      setPhase("idle");
      return;
    }

    router.push(`/grading/work/${result.documentId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Student homework file
        </span>
        <input
          name="file"
          type="file"
          accept={HOMEWORK_ACCEPT}
          required
          disabled={busy}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />
      </label>
      <p className="text-xs leading-5 text-slate-500">
        .docx, .pdf, or a photo of paper work (.jpg, .png, .heic) · max 20MB.
        We match the student from the filename, then you confirm and save into
        an M1U1L1-HW folder.
      </p>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {busy ? (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-full animate-pulse bg-slate-800" />
          </div>
          <p className="text-xs text-slate-500">
            {phase === "uploading"
              ? "Uploading file…"
              : "Matching this file to a student…"}
          </p>
        </div>
      ) : null}
      <button type="submit" disabled={busy} className={buttonClass}>
        {busy ? "Working…" : "Upload homework"}
      </button>
    </form>
  );
}

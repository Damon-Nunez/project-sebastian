"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveAssignmentReferenceAction } from "@/app/grading/assignmentActions";
import { FileDropzone } from "@/components/FileDropzone";
import type { ReferenceKind } from "@/lib/db/types";
import { gradingErrorMessage } from "@/lib/grading/errors";
import {
  MAX_REFERENCE_PHOTO_PAGES,
  REFERENCE_FILE_ACCEPT,
  referenceKindLabel,
} from "@/lib/grading/reference";
import { uploadFileToStudentWork } from "@/lib/grading/uploadClient";

type AssignmentReferenceFormProps = {
  assignmentId: string;
  initialKind: ReferenceKind;
  initialText: string;
  currentFilename: string | null;
  /** True when a reference has been saved at least once. */
  referenceSet: boolean;
};

const KIND_HELP: Record<ReferenceKind, string> = {
  answer_key: "Correct answers — grading checks each item against it.",
  exemplar:
    "A strong sample — grading compares quality against it. Names are removed before AI.",
  none: "No reference — grading uses the rubric alone and shows a badge.",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500";

export function AssignmentReferenceForm({
  assignmentId,
  initialKind,
  initialText,
  currentFilename,
  referenceSet,
}: AssignmentReferenceFormProps) {
  const router = useRouter();
  const [kind, setKind] = useState<ReferenceKind>(initialKind);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function persist(input: {
    kind: ReferenceKind;
    text?: string;
    successMessage: string;
  }): Promise<boolean> {
    setBusy(true);
    setError(null);
    setStatus(null);
    setProgress(null);
    try {
      const result = await saveAssignmentReferenceAction({
        assignmentId,
        kind: input.kind,
        text: input.text,
      });
      if (!result.ok) {
        setError(gradingErrorMessage(result.code));
        return false;
      }
      if (typeof result.text === "string") setText(result.text);
      setStatus(input.successMessage);
      router.refresh();
      return true;
    } catch (err) {
      console.error("Saving assignment reference failed", err);
      setError(gradingErrorMessage("reference_failed"));
      return false;
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleFileUpload(files: File[]) {
    if (files.length === 0 || busy || kind === "none") return;
    if (files.length > MAX_REFERENCE_PHOTO_PAGES) {
      setError(gradingErrorMessage("reference_too_many_photos"));
      return;
    }

    // CamScanner-style names: …_1.jpg, …_10.jpg — keep numeric order.
    const sorted = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );

    setBusy(true);
    setError(null);
    setStatus(null);
    setProgress(`Received ${sorted.length} file${sorted.length === 1 ? "" : "s"} — uploading…`);
    try {
      const uploadedFiles: Array<{ storagePath: string; filename: string }> = [];
      for (const [index, file] of sorted.entries()) {
        setProgress(`Uploading ${index + 1} of ${sorted.length}: ${file.name}`);
        const uploaded = await uploadFileToStudentWork(file);
        if (!uploaded.ok) {
          setError(
            `${file.name}: ${gradingErrorMessage(uploaded.code) ?? "Upload failed."}`,
          );
          return;
        }
        uploadedFiles.push({
          storagePath: uploaded.storagePath,
          filename: file.name,
        });
      }

      const looksLikePhotos = sorted.every((file) =>
        /\.(jpe?g|png|heic|heif)$/i.test(file.name),
      );
      setProgress(
        looksLikePhotos
          ? `Reading ${uploadedFiles.length} answer-key page${uploadedFiles.length === 1 ? "" : "s"} with AI…`
          : `Saving ${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"}…`,
      );

      const result = await saveAssignmentReferenceAction({
        assignmentId,
        kind,
        files: uploadedFiles,
      });
      if (!result.ok) {
        setError(gradingErrorMessage(result.code));
        return;
      }

      if (typeof result.text === "string") setText(result.text);

      if (result.source === "vision") {
        setStatus(
          `Structured answer key from ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}. Check the list below — fix anything unclear, then Save text edits.`,
        );
      } else if (result.pageCount > 1) {
        setStatus(
          `Saved ${result.pageCount} files. Check the extracted text below.`,
        );
      } else {
        setStatus(
          `${referenceKindLabel(kind)} saved from ${sorted[0]!.name}. Check the text below.`,
        );
      }
      router.refresh();
    } catch (err) {
      console.error("Answer key upload failed", err);
      setError(gradingErrorMessage("reference_failed"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kind === "none") {
      await persist({
        kind: "none",
        successMessage: "Answer key cleared — grading on rubric only.",
      });
      return;
    }
    await persist({
      kind,
      text,
      successMessage: `${referenceKindLabel(kind)} text saved.`,
    });
  }

  async function handleClear() {
    setKind("none");
    setText("");
    await persist({
      kind: "none",
      successMessage: "Answer key cleared — grading on rubric only.",
    });
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">
          What are you grading against?
        </legend>
        {(["answer_key", "exemplar", "none"] as const).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          >
            <input
              type="radio"
              name="kind"
              value={option}
              checked={kind === option}
              onChange={() => {
                setKind(option);
                setStatus(null);
                setError(null);
              }}
              disabled={busy}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-slate-900">
                {option === "none" ? "No answer key" : referenceKindLabel(option)}
              </span>
              <span className="block text-slate-500">{KIND_HELP[option]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {kind !== "none" ? (
        <>
          <FileDropzone
            title={
              currentFilename
                ? "Drop a replacement key — all pages at once"
                : "Drop the answer key or example — all pages at once"
            }
            subtitle={`.docx, .pdf, or photos (.jpg, .png, .heic) · up to ${MAX_REFERENCE_PHOTO_PAGES} pages · photo keys are read with AI into 1. A / 2. B form`}
            accept={REFERENCE_FILE_ACCEPT}
            multiple
            disabled={busy}
            buttonLabel={
              busy
                ? "Working…"
                : currentFilename
                  ? "Replace file(s)"
                  : "Choose file(s)"
            }
            onFiles={(files) => void handleFileUpload(files)}
          />

          {progress ? (
            <p className="text-sm text-slate-600" aria-live="polite">
              {progress}
            </p>
          ) : null}

          {currentFilename || referenceSet ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-700">
                {currentFilename ? (
                  <>
                    Current file:{" "}
                    <span className="font-medium text-slate-900">
                      {currentFilename}
                    </span>
                  </>
                ) : (
                  "A reference is saved for this assignment."
                )}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleClear()}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Clear answer key
              </button>
            </div>
          ) : null}

          <form onSubmit={handleTextSubmit} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Structured answer key — edit before grading
              </span>
              <textarea
                name="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={12}
                disabled={busy}
                placeholder={"1. A\n2. B\n3. Q: … / A: …\n4. Visual: …"}
                className={`${inputClass} font-mono`}
              />
              <span className="block text-xs text-slate-500">
                Photo keys are parsed with AI into this list. Student papers still
                use masked vision after you approve the preview.
              </span>
            </label>

            {error ? (
              <p
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {status ? (
              <p
                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
                role="status"
              >
                {status}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? "Saving…" : "Save text edits"}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={handleTextSubmit} className="space-y-3">
          {referenceSet ? (
            <p className="text-sm text-slate-600">
              Choosing this removes the saved answer key or example.
            </p>
          ) : null}
          {error ? (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {status ? (
            <p
              className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
              role="status"
            >
              {status}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? "Saving…" : "Grade on rubric only"}
          </button>
        </form>
      )}
    </div>
  );
}

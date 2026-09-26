"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveAssignmentReferenceAction } from "@/app/grading/assignmentActions";
import type { ReferenceKind } from "@/lib/db/types";
import { gradingErrorMessage } from "@/lib/grading/errors";
import {
  REFERENCE_FILE_ACCEPT,
  referenceKindLabel,
} from "@/lib/grading/reference";
import { uploadFileToStudentWork } from "@/lib/grading/uploadClient";

type AssignmentReferenceFormProps = {
  assignmentId: string;
  initialKind: ReferenceKind;
  initialText: string;
  currentFilename: string | null;
};

const KIND_HELP: Record<ReferenceKind, string> = {
  answer_key: "Correct answers — grading checks each item against it.",
  exemplar: "A strong sample — grading compares quality against it. Names are removed before AI.",
  none: "No reference — grading uses the rubric alone and shows a badge.",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500";

export function AssignmentReferenceForm({
  assignmentId,
  initialKind,
  initialText,
  currentFilename,
}: AssignmentReferenceFormProps) {
  const router = useRouter();
  const [kind, setKind] = useState<ReferenceKind>(initialKind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    const text = String(formData.get("text") ?? "");

    setBusy(true);
    setError(null);
    try {
      let storagePath: string | undefined;
      let filename: string | undefined;
      if (kind !== "none" && file instanceof File && file.size > 0) {
        const uploaded = await uploadFileToStudentWork(file);
        if (!uploaded.ok) {
          setError(gradingErrorMessage(uploaded.code));
          return;
        }
        storagePath = uploaded.storagePath;
        filename = file.name;
      }

      const result = await saveAssignmentReferenceAction({
        assignmentId,
        kind,
        text,
        storagePath,
        filename,
      });
      if (!result.ok) {
        setError(gradingErrorMessage(result.code));
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("Saving assignment reference failed", err);
      setError(gradingErrorMessage("reference_failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
              onChange={() => setKind(option)}
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
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Upload file (.docx or .pdf)
            </span>
            <input
              name="file"
              type="file"
              accept={REFERENCE_FILE_ACCEPT}
              disabled={busy}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
            />
            {currentFilename ? (
              <span className="block text-xs text-slate-500">
                Current file: {currentFilename}
              </span>
            ) : null}
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Or paste / edit the text
            </span>
            <textarea
              name="text"
              defaultValue={initialText}
              rows={12}
              disabled={busy}
              placeholder={"1. B\n2. The narrator feels isolated because…"}
              className={`${inputClass} font-mono`}
            />
            <span className="block text-xs text-slate-500">
              A new file replaces this text. Check it after upload and fix
              anything that came through garbled.
            </span>
          </label>
        </>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
      >
        {busy
          ? "Saving…"
          : kind === "none"
            ? "Grade on rubric only"
            : `Save ${referenceKindLabel(kind).toLowerCase()}`}
      </button>
    </form>
  );
}

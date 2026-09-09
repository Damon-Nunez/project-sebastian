"use client";

import { uploadFrameworkAction } from "@/app/lessons/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

const buttonClass =
  "w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70";

export function FrameworkUploadForm() {
  return (
    <form action={uploadFrameworkAction} className="mt-4 space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          District framework file
        </span>
        <input
          name="file"
          type="file"
          accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />
      </label>
      <p className="text-xs leading-5 text-slate-500">
        .docx or .pdf · max 20MB · parsing runs on upload (may take a few
        seconds).
      </p>
      <PendingSubmitButton
        idleLabel="Upload & pre-fill"
        pendingLabel="Parsing framework…"
        className={buttonClass}
      />
    </form>
  );
}

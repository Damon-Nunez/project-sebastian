"use client";

import { uploadFrameworkAction } from "@/app/lessons/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { useFormStatus } from "react-dom";

const buttonClass =
  "w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70";

function UploadProgress() {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <div className="space-y-2" aria-live="polite" aria-busy="true">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-full animate-pulse bg-slate-800" />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-600 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-600 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-600" />
        </span>
        Parsing framework with AI — this can take a few seconds…
      </div>
    </div>
  );
}

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
      <UploadProgress />
      <PendingSubmitButton
        idleLabel="Upload & pre-fill"
        pendingLabel="Parsing framework…"
        className={buttonClass}
      />
    </form>
  );
}

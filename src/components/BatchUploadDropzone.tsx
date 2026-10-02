"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import {
  finalizeBatchUploadAction,
  requestBatchUploadAction,
  type BatchUploadTarget,
} from "@/app/grading/batchActions";
import { gradingErrorMessage } from "@/lib/grading/errors";
import {
  HOMEWORK_ACCEPT,
  MAX_BATCH_FILES,
} from "@/lib/grading/studentWorkFiles";
import { uploadToSignedTarget } from "@/lib/grading/uploadClient";

const UPLOAD_CONCURRENCY = 4;

type FailedFile = { file: File; message: string };

export function BatchUploadDropzone({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [failed, setFailed] = useState<FailedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

  async function uploadOne(
    file: File,
    target: BatchUploadTarget,
  ): Promise<string | null> {
    if (!target.ok) return gradingErrorMessage(target.code);
    if (!(await uploadToSignedTarget(file, target))) {
      return gradingErrorMessage("upload_failed");
    }
    const result = await finalizeBatchUploadAction({
      assignmentId,
      storagePath: target.storagePath,
      filename: file.name,
    });
    return result.ok ? null : gradingErrorMessage(result.code);
  }

  async function uploadBatch(files: File[]) {
    if (files.length === 0 || busy) return;
    if (files.length > MAX_BATCH_FILES) {
      setError(gradingErrorMessage("batch_too_large"));
      return;
    }

    setError(null);
    setFailed([]);
    setProgress({ done: 0, total: files.length });

    const signed = await requestBatchUploadAction({
      assignmentId,
      files: files.map((file) => ({ filename: file.name, size: file.size })),
    }).catch(() => null);
    if (!signed?.ok) {
      setError(gradingErrorMessage(signed?.code ?? "upload_failed"));
      setProgress(null);
      return;
    }

    const { targets } = signed;
    const failures: FailedFile[] = [];
    let next = 0;
    async function worker() {
      while (next < files.length) {
        const index = next++;
        const file = files[index]!;
        const message = await uploadOne(file, targets[index]!).catch(
          () => gradingErrorMessage("upload_failed"),
        );
        if (message) failures.push({ file, message });
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker),
    );

    setFailed(failures);
    setProgress(null);
    router.refresh();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadBatch(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? "border-slate-500 bg-slate-50" : "border-slate-300"
        }`}
      >
        <p className="text-sm font-medium text-slate-900">
          Drop the whole class&apos;s homework here
        </p>
        <p className="mt-1 text-xs text-slate-500">
          .docx, .pdf, or photos (.jpg, .png, .heic) · up to {MAX_BATCH_FILES}{" "}
          files, 20MB each
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={HOMEWORK_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void uploadBatch(files);
          }}
        />
      </div>

      {progress ? (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-slate-800 transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Uploading {progress.done} of {progress.total}…
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {failed.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">
              {failed.length} {failed.length === 1 ? "file" : "files"} didn&apos;t
              upload
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void uploadBatch(failed.map((f) => f.file))}
              className="rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-red-100"
            >
              Retry
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {failed.map(({ file, message }) => (
              <li key={`${file.name}-${file.size}`}>
                <span className="font-medium">{file.name}</span> — {message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

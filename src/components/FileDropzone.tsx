"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";

type FileDropzoneProps = {
  title: string;
  subtitle: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
};

function filesFromDataTransfer(dataTransfer: DataTransfer, multiple: boolean): File[] {
  const collected: File[] = [];

  if (dataTransfer.items?.length) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) collected.push(file);
      if (!multiple && collected.length > 0) break;
    }
  }

  if (collected.length === 0 && dataTransfer.files?.length) {
    collected.push(...Array.from(dataTransfer.files));
  }

  // Dedupe by name+size+lastModified (some browsers repeat entries).
  const seen = new Set<string>();
  const unique = collected.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return multiple ? unique : unique.slice(0, 1);
}

/** Shared dashed dropzone chrome for answer key + homework uploads. */
export function FileDropzone({
  title,
  subtitle,
  accept,
  multiple = false,
  disabled = false,
  buttonLabel = "Choose files",
  onFiles,
  children,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function takeFiles(files: File[]) {
    if (files.length === 0 || disabled) return;
    onFiles(files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    takeFiles(filesFromDataTransfer(event.dataTransfer, multiple));
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging
            ? "border-slate-500 bg-slate-50"
            : "border-slate-300 bg-white"
        } ${disabled ? "opacity-70" : ""}`}
      >
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
        >
          {buttonLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            const list = Array.from(event.target.files ?? []);
            event.target.value = "";
            takeFiles(multiple ? list : list.slice(0, 1));
          }}
        />
      </div>
      {children}
    </div>
  );
}

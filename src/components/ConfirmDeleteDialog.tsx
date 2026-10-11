"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { deleteAssignmentFolderAction } from "@/app/grading/actions";
import { deleteAssignmentAction } from "@/app/grading/assignmentActions";
import { deleteLessonPlanAction } from "@/app/lessons/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

type ConfirmDeleteDialogProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  title: string;
  description: ReactNode;
  triggerLabel: string;
  confirmLabel: string;
  pendingLabel: string;
  variant?: "icon" | "button";
  className?: string;
};

function ConfirmDeleteDialog({
  action,
  hiddenFields,
  title,
  description,
  triggerLabel,
  confirmLabel,
  pendingLabel,
  variant = "button",
  className,
}: ConfirmDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    setOpen(false);
  }

  const triggerClass =
    className ??
    (variant === "icon"
      ? "rounded-md px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
      : "rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50");

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed left-1/2 top-1/2 z-50 w-[min(100%,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
        onClose={close}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <form action={action} className="space-y-4 p-6">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={close}
            >
              Cancel
            </button>
            <PendingSubmitButton
              idleLabel={confirmLabel}
              pendingLabel={pendingLabel}
              className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-70"
            />
          </div>
        </form>
      </dialog>
    </>
  );
}

function subject(name: string) {
  return <span className="font-medium text-slate-900">{name}</span>;
}

export function DeleteAssignmentButton({
  assignmentId,
  assignmentTitle,
  variant = "button",
  className,
}: {
  assignmentId: string;
  assignmentTitle: string;
  variant?: "icon" | "button";
  className?: string;
}) {
  return (
    <ConfirmDeleteDialog
      action={deleteAssignmentAction}
      hiddenFields={{ assignmentId }}
      title="Delete this assignment?"
      description={
        <>
          {subject(assignmentTitle)}, its answer key, every period folder, and
          all student work under it will be permanently removed. This cannot be
          undone.
        </>
      }
      triggerLabel={variant === "icon" ? "Delete" : "Delete assignment"}
      confirmLabel="Delete assignment"
      pendingLabel="Deleting…"
      variant={variant}
      className={className}
    />
  );
}

export function DeleteAssignmentFolderButton({
  sessionId,
  periodId,
  folderTitle,
  variant = "button",
  className,
}: {
  sessionId: string;
  periodId: string;
  folderTitle: string;
  variant?: "icon" | "button";
  className?: string;
}) {
  return (
    <ConfirmDeleteDialog
      action={deleteAssignmentFolderAction}
      hiddenFields={{ sessionId, periodId }}
      title="Delete this period folder?"
      description={
        <>
          {subject(folderTitle)} for this class and the student work saved in
          it will be permanently removed. The shared assignment and answer key
          stay. This cannot be undone.
        </>
      }
      triggerLabel={variant === "icon" ? "Delete" : "Delete folder"}
      confirmLabel="Delete folder"
      pendingLabel="Deleting…"
      variant={variant}
      className={className}
    />
  );
}

export function DeleteLessonDraftButton({
  lessonId,
  draftTitle,
  variant = "button",
  className,
}: {
  lessonId: string;
  draftTitle: string;
  variant?: "icon" | "button";
  className?: string;
}) {
  return (
    <ConfirmDeleteDialog
      action={deleteLessonPlanAction}
      hiddenFields={{ lessonId }}
      title="Delete this draft?"
      description={
        <>
          {subject(draftTitle)} will be permanently removed. This cannot be
          undone.
        </>
      }
      triggerLabel={variant === "icon" ? "Delete" : "Delete draft"}
      confirmLabel="Delete draft"
      pendingLabel="Deleting…"
      variant={variant}
      className={className}
    />
  );
}

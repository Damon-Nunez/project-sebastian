"use client";

import { useEffect, useId, useRef, useState } from "react";
import { deleteAssignmentFolderAction } from "@/app/grading/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

type DeleteAssignmentFolderButtonProps = {
  sessionId: string;
  periodId: string;
  folderTitle: string;
  variant?: "icon" | "button";
  className?: string;
};

export function DeleteAssignmentFolderButton({
  sessionId,
  periodId,
  folderTitle,
  variant = "button",
  className,
}: DeleteAssignmentFolderButtonProps) {
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
        {variant === "icon" ? "Delete" : "Delete assignment"}
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
        <form action={deleteAssignmentFolderAction} className="space-y-4 p-6">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="periodId" value={periodId} />
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            Delete this assignment?
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            <span className="font-medium text-slate-900">{folderTitle}</span>{" "}
            and the student work saved in it will be permanently removed. This
            cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={close}
            >
              Cancel
            </button>
            <PendingSubmitButton
              idleLabel="Delete assignment"
              pendingLabel="Deleting…"
              className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-wait disabled:opacity-70"
            />
          </div>
        </form>
      </dialog>
    </>
  );
}

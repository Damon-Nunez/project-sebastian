"use client";

import { saveHomeworkDraftAction } from "@/app/grading/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

type HomeworkEditorFormProps = {
  documentId: string;
  canSave: boolean;
  defaultModuleLabel: string;
  defaultUnitLabel: string;
  defaultLessonLabel: string;
};

export function HomeworkEditorForm({
  documentId,
  canSave,
  defaultModuleLabel,
  defaultUnitLabel,
  defaultLessonLabel,
}: HomeworkEditorFormProps) {
  return (
    <form action={saveHomeworkDraftAction} className="space-y-4">
      <input type="hidden" name="documentId" value={documentId} />
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Type
        </span>
        <select
          name="assignmentType"
          defaultValue="hw"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
        >
          <option value="hw">HW</option>
          <option value="short_response">CW</option>
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Module
          </span>
          <input
            name="moduleLabel"
            defaultValue={defaultModuleLabel}
            placeholder="1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Unit
          </span>
          <input
            name="unitLabel"
            defaultValue={defaultUnitLabel}
            placeholder="1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Lesson
          </span>
          <input
            name="lessonLabel"
            defaultValue={defaultLessonLabel}
            placeholder="1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        Saves as a folder like{" "}
        <span className="font-medium text-slate-700">M1U1L1-HW</span>.
      </p>
      {!canSave ? (
        <p className="text-sm text-amber-800">
          Confirm a student before saving into a class folder.
        </p>
      ) : null}
      {canSave ? (
        <PendingSubmitButton
          idleLabel="Save to class folder"
          pendingLabel="Saving…"
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        />
      ) : (
        <button
          type="button"
          disabled
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white opacity-60"
        >
          Save to class folder
        </button>
      )}
    </form>
  );
}

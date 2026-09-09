"use client";

import { useState, type ChangeEvent } from "react";
import { saveLessonPlanAction } from "@/app/lessons/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import {
  resizeWorkTimes,
  type LessonPlanContent,
} from "@/lib/lessons/content";

type LessonPlanEditorProps = {
  lessonId: string;
  initialContent: LessonPlanContent;
  initialFreeTextAsks: string;
  initialModuleLabel: string;
  initialUnitLabel: string;
  initialLessonLabel: string;
};

const labelClass =
  "text-xs font-medium uppercase tracking-wide text-slate-500";
const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500";
const textareaClass = `${inputClass} min-h-28 resize-y`;
const buttonClass =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70";

export function LessonPlanEditor({
  lessonId,
  initialContent,
  initialFreeTextAsks,
  initialModuleLabel,
  initialUnitLabel,
  initialLessonLabel,
}: LessonPlanEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [freeTextAsks, setFreeTextAsks] = useState(initialFreeTextAsks);
  const [moduleLabel, setModuleLabel] = useState(initialModuleLabel);
  const [unitLabel, setUnitLabel] = useState(initialUnitLabel);
  const [lessonLabel, setLessonLabel] = useState(initialLessonLabel);

  function onWorkTimeCountChange(event: ChangeEvent<HTMLInputElement>) {
    const count = Number(event.target.value);
    if (!Number.isFinite(count)) return;
    setContent((prev) => resizeWorkTimes(prev, Math.min(8, Math.max(1, count))));
  }

  return (
    <form action={saveLessonPlanAction} className="space-y-6">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="contentJson" value={JSON.stringify(content)} />
      <input type="hidden" name="freeTextAsks" value={freeTextAsks} />
      <input type="hidden" name="moduleLabel" value={moduleLabel} />
      <input type="hidden" name="unitLabel" value={unitLabel} />
      <input type="hidden" name="lessonLabel" value={lessonLabel} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Lesson details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className={labelClass}>Date</span>
            <input
              type="date"
              className={inputClass}
              value={content.lessonDate ?? ""}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  lessonDate: e.target.value ? e.target.value : null,
                }))
              }
            />
          </label>
          <label className="block">
            <span className={labelClass}>Module</span>
            <input
              className={inputClass}
              value={moduleLabel}
              onChange={(e) => setModuleLabel(e.target.value)}
              placeholder="1"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Unit</span>
            <input
              className={inputClass}
              value={unitLabel}
              onChange={(e) => setUnitLabel(e.target.value)}
              placeholder="1"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Lesson</span>
            <input
              className={inputClass}
              value={lessonLabel}
              onChange={(e) => setLessonLabel(e.target.value)}
              placeholder="7"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className={labelClass}>Standards</span>
          <textarea
            className={textareaClass}
            value={content.standards}
            onChange={(e) =>
              setContent((prev) => ({ ...prev, standards: e.target.value }))
            }
          />
        </label>
        <label className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className={labelClass}>Agenda</span>
          <textarea
            className={textareaClass}
            value={content.agenda}
            onChange={(e) =>
              setContent((prev) => ({ ...prev, agenda: e.target.value }))
            }
          />
        </label>
        <label className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className={labelClass}>Materials</span>
          <textarea
            className={textareaClass}
            value={content.materials}
            onChange={(e) =>
              setContent((prev) => ({ ...prev, materials: e.target.value }))
            }
          />
        </label>
        <label className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className={labelClass}>Work Time blocks</span>
          <input
            type="number"
            min={1}
            max={8}
            className={inputClass}
            value={content.workTimes.length}
            onChange={onWorkTimeCountChange}
          />
          <p className="mt-2 text-xs text-slate-500">
            1–8 blocks. Reducing count drops the last blocks only.
          </p>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <label className="block">
          <span className={labelClass}>Opening label</span>
          <input
            className={inputClass}
            value={content.opening.label}
            onChange={(e) =>
              setContent((prev) => ({
                ...prev,
                opening: { ...prev.opening, label: e.target.value },
              }))
            }
          />
        </label>
        <label className="block">
          <span className={labelClass}>Opening</span>
          <textarea
            className={`${textareaClass} min-h-36`}
            value={content.opening.body}
            onChange={(e) =>
              setContent((prev) => ({
                ...prev,
                opening: { ...prev.opening, body: e.target.value },
              }))
            }
          />
        </label>
      </div>

      {content.workTimes.map((wt, index) => (
        <div
          key={wt.key}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
        >
          <label className="block">
            <span className={labelClass}>Work Time {wt.key} label</span>
            <input
              className={inputClass}
              value={wt.label}
              onChange={(e) => {
                const label = e.target.value;
                setContent((prev) => ({
                  ...prev,
                  workTimes: prev.workTimes.map((block, i) =>
                    i === index ? { ...block, label } : block,
                  ),
                }));
              }}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Work Time {wt.key}</span>
            <textarea
              className={`${textareaClass} min-h-36`}
              value={wt.body}
              onChange={(e) => {
                const body = e.target.value;
                setContent((prev) => ({
                  ...prev,
                  workTimes: prev.workTimes.map((block, i) =>
                    i === index ? { ...block, body } : block,
                  ),
                }));
              }}
            />
          </label>
        </div>
      ))}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <label className="block">
          <span className={labelClass}>Closing label</span>
          <input
            className={inputClass}
            value={content.closing.label}
            onChange={(e) =>
              setContent((prev) => ({
                ...prev,
                closing: { ...prev.closing, label: e.target.value },
              }))
            }
          />
        </label>
        <label className="block">
          <span className={labelClass}>Closing</span>
          <textarea
            className={`${textareaClass} min-h-36`}
            value={content.closing.body}
            onChange={(e) =>
              setContent((prev) => ({
                ...prev,
                closing: { ...prev.closing, body: e.target.value },
              }))
            }
          />
        </label>
      </div>

      {content.extras.length > 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Extra parsed sections
          </h2>
          {content.extras.map((extra, index) => (
            <label key={`${extra.label}-${index}`} className="block">
              <span className={labelClass}>{extra.label}</span>
              <textarea
                className={textareaClass}
                value={extra.body}
                onChange={(e) => {
                  const body = e.target.value;
                  setContent((prev) => ({
                    ...prev,
                    extras: prev.extras.map((item, i) =>
                      i === index ? { ...item, body } : item,
                    ),
                  }));
                }}
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className={labelClass}>Extra custom request</span>
          <textarea
            className={`${textareaClass} min-h-24`}
            value={freeTextAsks}
            onChange={(e) => setFreeTextAsks(e.target.value)}
            placeholder="Anything else for generation that isn’t covered above…"
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Free-form asks for Ticket 7 AI generation. Saved on this draft now.
        </p>
      </div>

      <div className="flex items-center justify-end gap-3">
        <PendingSubmitButton
          idleLabel="Save draft"
          pendingLabel="Saving…"
          className={buttonClass}
        />
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import type { LessonPlanContent } from "@/lib/lessons/content";
import {
  applyOptionalRoutinesToContent,
  createRoutineBlock,
  ROUTINE_KIND_LABEL,
  type OptionalRoutines,
  type RoutineBlock,
  type RoutineKind,
  type RoutinePlacement,
  routineTargetOptions,
} from "@/lib/lessons/optionalRoutines";

const labelClass =
  "text-xs font-medium uppercase tracking-wide text-slate-500";
const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100";
const textareaClass = `${inputClass} min-h-28`;

type OptionalRoutinesEditorProps = {
  content: LessonPlanContent;
  optionalRoutines: OptionalRoutines;
  onChangeRoutines: (next: OptionalRoutines) => void;
  onChangeContent: (next: LessonPlanContent) => void;
};

function defaultTargetKey(
  kind: RoutineKind,
  targets: { key: string }[],
): string {
  if (kind === "thinkPairShare") {
    return (
      targets.find((t) => t.key.startsWith("workTime:"))?.key ??
      targets[0]?.key ??
      "opening"
    );
  }
  return targets.find((t) => t.key === "opening")?.key ?? targets[0]?.key ?? "opening";
}

function KindBlocksEditor({
  kind,
  blocks,
  content,
  onChangeBlocks,
}: {
  kind: RoutineKind;
  blocks: RoutineBlock[];
  content: LessonPlanContent;
  onChangeBlocks: (next: RoutineBlock[]) => void;
}) {
  const targets = routineTargetOptions(content);
  const label = ROUTINE_KIND_LABEL[kind];
  const enabled = blocks.length > 0;

  function addBlock() {
    onChangeBlocks([
      ...blocks,
      createRoutineBlock(defaultTargetKey(kind, targets)),
    ]);
  }

  function removeAll() {
    onChangeBlocks([]);
  }

  function updateBlock(id: string, patch: Partial<RoutineBlock>) {
    onChangeBlocks(
      blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)),
    );
  }

  function removeBlock(id: string) {
    onChangeBlocks(blocks.filter((block) => block.id !== id));
  }

  if (!enabled) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-linear-to-br from-white to-sky-50/40 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className={labelClass}>{label} Optional Prompts</span>
            <p className="mt-0.5 text-xs text-slate-500">
              Optional — add one or more blocks, then Apply to plan (no polish
              required).
            </p>
          </div>
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            Optional
          </span>
        </div>
        <button
          type="button"
          className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-medium text-sky-900 shadow-sm hover:bg-sky-50"
          onClick={addBlock}
        >
          Add {label} block
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-sm font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">
            {label} Optional Prompts
          </span>
          <p className="mt-1 text-xs text-slate-500">
            {blocks.length} block{blocks.length === 1 ? "" : "s"} — set target,
            placement, and prompts, then Apply to plan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-50"
            onClick={addBlock}
          >
            Add block
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={removeAll}
          >
            Remove all
          </button>
        </div>
      </div>

      {blocks.map((block, index) => (
        <div
          key={block.id}
          className="space-y-3 border-t border-slate-100 pt-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">
              {label} {index + 1}
            </p>
            <button
              type="button"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
              onClick={() => removeBlock(block.id)}
            >
              Remove block
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Target section</span>
              <select
                className={inputClass}
                value={block.targetSectionKey}
                onChange={(e) =>
                  updateBlock(block.id, { targetSectionKey: e.target.value })
                }
              >
                {targets.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="block">
              <legend className={labelClass}>Placement</legend>
              <div className="mt-2 space-y-2">
                {(
                  [
                    {
                      id: "append" as RoutinePlacement,
                      title: "Append under section",
                      hint: `Add ${ROUTINE_KIND_LABEL[kind]} at the end of that section.`,
                    },
                    {
                      id: "weave" as RoutinePlacement,
                      title: "Weave into section",
                      hint: "Insert after the first paragraph of that section.",
                    },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer gap-2 rounded-lg border px-3 py-2 text-sm ${
                      block.placement === opt.id
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-slate-50/80"
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-0.5"
                      name={`${kind}-placement-${block.id}`}
                      checked={block.placement === opt.id}
                      onChange={() =>
                        updateBlock(block.id, { placement: opt.id })
                      }
                    />
                    <span>
                      <span className="font-medium text-slate-800">
                        {opt.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <label className="block">
            <span className={labelClass}>Prompts</span>
            <textarea
              className={textareaClass}
              value={block.prompts}
              onChange={(e) =>
                updateBlock(block.id, { prompts: e.target.value })
              }
              placeholder={
                kind === "thinkPairShare"
                  ? "e.g. What is the gist? What is this chapter mostly about?\n(Students may say…)"
                  : "e.g. What do you think you will be doing in this lesson…?\n(We will be listening to one another…)"
              }
            />
          </label>
        </div>
      ))}
    </div>
  );
}

export function OptionalRoutinesEditor({
  content,
  optionalRoutines,
  onChangeRoutines,
  onChangeContent,
}: OptionalRoutinesEditorProps) {
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  const turnAndTalk = optionalRoutines.turnAndTalk ?? [];
  const thinkPairShare = optionalRoutines.thinkPairShare ?? [];
  const totalBlocks = turnAndTalk.length + thinkPairShare.length;
  const readyCount =
    [...turnAndTalk, ...thinkPairShare].filter((b) => b.prompts.trim())
      .length;

  function setKind(kind: RoutineKind, blocks: RoutineBlock[]) {
    onChangeRoutines({
      ...optionalRoutines,
      [kind]: blocks,
    });
    setApplyMessage(null);
  }

  function applyToPlan() {
    const result = applyOptionalRoutinesToContent(content, optionalRoutines);
    onChangeContent(result.content);
    onChangeRoutines(result.routines);
    if (result.appliedCount === 0) {
      if (result.skippedInvalidTarget > 0) {
        setApplyMessage(
          `Nothing applied — ${result.skippedInvalidTarget} block(s) point at a section that no longer exists (check Work Time targets).`,
        );
        return;
      }
      setApplyMessage(
        "Nothing applied — add prompts to at least one block first.",
      );
      return;
    }
    const notes: string[] = [];
    if (result.skippedEmpty > 0) {
      notes.push(`skipped ${result.skippedEmpty} empty`);
    }
    if (result.skippedInvalidTarget > 0) {
      notes.push(
        `skipped ${result.skippedInvalidTarget} with invalid target section`,
      );
    }
    const skipNote = notes.length > 0 ? ` (${notes.join("; ")})` : "";
    setApplyMessage(
      `Applied ${result.appliedCount} routine(s) into the plan bodies${skipNote}. Save draft when ready.`,
    );
  }

  return (
    <div className="space-y-4">
      <KindBlocksEditor
        kind="turnAndTalk"
        blocks={turnAndTalk}
        content={content}
        onChangeBlocks={(blocks) => setKind("turnAndTalk", blocks)}
      />
      <KindBlocksEditor
        kind="thinkPairShare"
        blocks={thinkPairShare}
        content={content}
        onChangeBlocks={(blocks) => setKind("thinkPairShare", blocks)}
      />

      {totalBlocks > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <button
            type="button"
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readyCount === 0}
            onClick={applyToPlan}
          >
            Apply routines to plan
          </button>
          <p className="text-xs text-slate-600">
            Writes into Opening / Work Time / Closing bodies locally — polish is
            optional afterward.
          </p>
          {applyMessage ? (
            <p className="w-full text-sm text-slate-800" role="status">
              {applyMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

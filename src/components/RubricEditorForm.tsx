"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import {
  emptyRubricCriteria,
  type RubricCategory,
  type RubricCriteria,
  type RubricLevel,
} from "@/lib/rubrics/criteria";

type RubricEditorFormProps = {
  initialName: string;
  initialCriteria: RubricCriteria | null;
  /** Extra hidden fields (unitId, rubricId, etc.). */
  hiddenFields?: Record<string, string>;
  basicsHelp: string;
  namePlaceholder: string;
  submitLabel: string;
  action: (formData: FormData) => Promise<void>;
};

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function rebuildCells(
  criteria: RubricCriteria,
  levels: RubricLevel[],
  categories: RubricCategory[],
): RubricCriteria["cells"] {
  const prev = new Map(
    criteria.cells.map((c) => [`${c.categoryId}::${c.levelId}`, c.description]),
  );
  const cells: RubricCriteria["cells"] = [];
  for (const category of categories) {
    for (const level of levels) {
      const key = `${category.id}::${level.id}`;
      cells.push({
        categoryId: category.id,
        levelId: level.id,
        description: prev.get(key) ?? "",
      });
    }
  }
  return cells;
}

function withScale(levels: RubricLevel[], base: RubricCriteria): RubricCriteria {
  const scores = levels.map((l) => l.score);
  return {
    ...base,
    levels,
    scale: {
      ...base.scale,
      min: Math.min(...scores),
      max: Math.max(...scores),
    },
  };
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500";
const labelClass =
  "text-xs font-medium uppercase tracking-wide text-slate-500";

export function RubricEditorForm({
  initialName,
  initialCriteria,
  hiddenFields,
  basicsHelp,
  namePlaceholder,
  submitLabel,
  action,
}: RubricEditorFormProps) {
  const [name, setName] = useState(initialName);
  const [criteria, setCriteria] = useState<RubricCriteria>(
    () =>
      initialCriteria ??
      emptyRubricCriteria({
        categoryNames: ["Category 1", "Category 2", "Category 3"],
      }),
  );
  const [pending, startTransition] = useTransition();
  const [showCategoryErrors, setShowCategoryErrors] = useState(false);

  const cellMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cell of criteria.cells) {
      map.set(`${cell.categoryId}::${cell.levelId}`, cell.description);
    }
    return map;
  }, [criteria.cells]);

  function updateLevel(levelId: string, patch: Partial<RubricLevel>) {
    setCriteria((prev) => {
      const levels = prev.levels.map((l) =>
        l.id === levelId ? { ...l, ...patch } : l,
      );
      return withScale(levels, { ...prev, levels });
    });
  }

  function updateCategory(categoryId: string, patch: Partial<RubricCategory>) {
    setCriteria((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === categoryId ? { ...c, ...patch } : c,
      ),
    }));
  }

  function setCell(categoryId: string, levelId: string, description: string) {
    setCriteria((prev) => ({
      ...prev,
      cells: prev.cells.map((c) =>
        c.categoryId === categoryId && c.levelId === levelId
          ? { ...c, description }
          : c,
      ),
    }));
  }

  function addCategory() {
    setCriteria((prev) => {
      const category: RubricCategory = {
        id: newId("category"),
        name: `Category ${prev.categories.length + 1}`,
        weight: null,
      };
      const categories = [...prev.categories, category];
      return {
        ...prev,
        categories,
        cells: rebuildCells(prev, prev.levels, categories),
      };
    });
  }

  function removeCategory(categoryId: string) {
    setCriteria((prev) => {
      if (prev.categories.length <= 1) return prev;
      const categories = prev.categories.filter((c) => c.id !== categoryId);
      return {
        ...prev,
        categories,
        cells: rebuildCells(prev, prev.levels, categories),
      };
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const blankCategory = criteria.categories.some((c) => !c.name.trim());
    if (blankCategory) {
      event.preventDefault();
      setShowCategoryErrors(true);
      return;
    }
    setShowCategoryErrors(false);

    const form = event.currentTarget;
    const nameInput = form.elements.namedItem("name") as HTMLInputElement;
    const criteriaInput = form.elements.namedItem(
      "criteriaJson",
    ) as HTMLInputElement;
    nameInput.value = name.trim();
    criteriaInput.value = JSON.stringify(criteria);
  }

  return (
    <form
      action={(formData) => {
        startTransition(() => {
          void action(formData);
        });
      }}
      onSubmit={onSubmit}
      className="space-y-8"
    >
      {hiddenFields
        ? Object.entries(hiddenFields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))
        : null}
      <input type="hidden" name="name" defaultValue={name} />
      <input type="hidden" name="criteriaJson" defaultValue="" />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Basics</h2>
        <p className="mt-1 text-sm text-slate-600">{basicsHelp}</p>
        <label className="mt-4 block space-y-1.5">
          <span className={labelClass}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={namePlaceholder}
            className={inputClass}
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Score levels</h2>
        <p className="mt-1 text-sm text-slate-600">
          Copy labels from your sheet (e.g. Exceeds / Meets / Approaching).
        </p>
        <ul className="mt-4 space-y-3">
          {criteria.levels.map((level) => (
            <li
              key={level.id}
              className="grid gap-3 sm:grid-cols-[5rem_minmax(0,1fr)]"
            >
              <label className="block space-y-1.5">
                <span className={labelClass}>Score</span>
                <input
                  type="number"
                  value={level.score}
                  onChange={(e) =>
                    updateLevel(level.id, {
                      score: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className={labelClass}>Label</span>
                <input
                  value={level.label}
                  onChange={(e) =>
                    updateLevel(level.id, { label: e.target.value })
                  }
                  placeholder="Meets Standards"
                  className={inputClass}
                />
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Categories &amp; descriptors
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Paste each bullet from your rubric into the matching box. Weights
              are optional.
            </p>
          </div>
          <button
            type="button"
            onClick={addCategory}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Add category
          </button>
        </div>

        <div className="mt-6 space-y-8">
          {criteria.categories.map((category) => (
            <div
              key={category.id}
              className="rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-48 flex-1 space-y-1.5">
                  <span className={labelClass}>Category name</span>
                  <input
                    value={category.name}
                    onChange={(e) => {
                      if (showCategoryErrors) setShowCategoryErrors(false);
                      updateCategory(category.id, { name: e.target.value });
                    }}
                    aria-invalid={
                      showCategoryErrors && !category.name.trim()
                        ? true
                        : undefined
                    }
                    className={
                      showCategoryErrors && !category.name.trim()
                        ? `${inputClass} border-red-400 focus:border-red-500`
                        : inputClass
                    }
                  />
                  {showCategoryErrors && !category.name.trim() ? (
                    <span className="text-xs font-medium text-red-600">
                      Category name is required
                    </span>
                  ) : null}
                </label>
                <label className="w-28 space-y-1.5">
                  <span className={labelClass}>Weight %</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={category.weight ?? ""}
                    placeholder="—"
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === "") {
                        updateCategory(category.id, { weight: null });
                        return;
                      }
                      // Match Zod: 0–100, optional decimals; block oversize drafts.
                      if (!/^\d{0,3}(\.\d{0,2})?$/.test(raw)) return;
                      const n = Number.parseFloat(raw);
                      if (!Number.isFinite(n) || n > 100) return;
                      updateCategory(category.id, { weight: n });
                    }}
                    className={inputClass}
                  />
                </label>
                {criteria.categories.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeCategory(category.id)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <ul className="mt-4 space-y-3">
                {criteria.levels.map((level) => (
                  <li key={level.id}>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-slate-600">
                        {level.score}
                        {level.label ? ` — ${level.label}` : ""}
                      </span>
                      <textarea
                        rows={2}
                        value={
                          cellMap.get(`${category.id}::${level.id}`) ?? ""
                        }
                        onChange={(e) =>
                          setCell(category.id, level.id, e.target.value)
                        }
                        placeholder="Paste descriptor from your rubric…"
                        className={inputClass}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

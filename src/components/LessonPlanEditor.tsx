"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import {
  addLessonPlanLinkAction,
  removeLessonImageAction,
  removeLessonPlanLinkAction,
  saveLessonPlanAction,
  uploadLessonImageAction,
} from "@/app/lessons/actions";
import { DeleteLessonDraftButton } from "@/components/DeleteLessonDraftButton";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import {
  bodyForViewMode,
  resizeWorkTimes,
  type BodyViewMode,
  type LessonPlanContent,
} from "@/lib/lessons/content";
import { DIFFERENTIATION_IMAGES } from "@/lib/lessons/differentiation";
import { LESSON_ERROR_MESSAGES, type LessonErrorCode } from "@/lib/lessons/errors";
import {
  imageSectionOptionsForContent,
  imagesForSection,
  linksForSection,
} from "@/lib/lessons/imageSections";
import { STANDARD_CLASSWORK_RUBRIC } from "@/lib/lessons/standardRubric";

type LessonPlanEditorProps = {
  lessonId: string;
  draftTitle: string;
  initialContent: LessonPlanContent;
  initialFreeTextAsks: string;
  initialModuleLabel: string;
  initialUnitLabel: string;
  initialLessonLabel: string;
  /** Signed URLs keyed by image id (from server). */
  initialImageUrls?: Record<string, string>;
};

type FieldStatus = "from-upload" | "edited" | "empty" | "yours" | "fixed";

const labelClass =
  "text-xs font-medium uppercase tracking-wide text-slate-500";
const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500";
const textareaClass = `${inputClass} min-h-28 resize-y`;
const buttonClass =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70";

function normalize(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function statusForText(initial: string, current: string): FieldStatus {
  const cur = normalize(current);
  const init = normalize(initial);
  if (!cur) return "empty";
  if (!init) return "edited";
  if (cur === init) return "from-upload";
  return "edited";
}

function findExtra(
  content: LessonPlanContent,
  label: string,
): { index: number; body: string } | null {
  const index = content.extras.findIndex(
    (e) => e.label.toLowerCase() === label.toLowerCase(),
  );
  if (index < 0) return null;
  return { index, body: content.extras[index]!.body };
}

function parseStandardsCodes(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function formatMinutes(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  return `${minutes} min`;
}

function StatusBadge({ status }: { status: FieldStatus }) {
  const copy: Record<FieldStatus, { text: string; className: string }> = {
    "from-upload": {
      text: "From upload",
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    },
    edited: {
      text: "Edited",
      className: "bg-amber-50 text-amber-900 ring-amber-200",
    },
    empty: {
      text: "Empty",
      className: "bg-slate-100 text-slate-600 ring-slate-200",
    },
    yours: {
      text: "You write",
      className: "bg-sky-50 text-sky-900 ring-sky-200",
    },
    fixed: {
      text: "Fixed",
      className: "bg-violet-50 text-violet-900 ring-violet-200",
    },
  };
  const item = copy[status];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${item.className}`}
    >
      {item.text}
    </span>
  );
}

function FieldHeader({
  title,
  status,
  hint,
}: {
  title: string;
  status: FieldStatus;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <span className={labelClass}>{title}</span>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function ViewModePills({
  value,
  onChange,
  size = "md",
}: {
  value: BodyViewMode | null;
  onChange: (mode: BodyViewMode) => void;
  size?: "sm" | "md";
}) {
  const modes: { id: BodyViewMode; label: string }[] = [
    { id: "edited", label: "Edited" },
    { id: "simplified", label: "Simplified" },
    { id: "original", label: "Original" },
  ];
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs";
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          className={`rounded-full font-medium ${pad} ${
            value === mode.id
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
          onClick={() => onChange(mode.id)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

function PreviewSection({
  title,
  children,
  empty,
  minutes,
  mode,
  onModeChange,
  images,
  links,
}: {
  title: string;
  children?: ReactNode;
  empty?: boolean;
  minutes?: number | null;
  mode?: BodyViewMode;
  onModeChange?: (mode: BodyViewMode) => void;
  images?: { id: string; url: string | undefined; caption: string; filename: string }[];
  links?: {
    id: string;
    url: string;
    thumbnailUrl: string;
    title: string;
    caption: string;
  }[];
}) {
  const time = formatMinutes(minutes);
  const hasImages = (images?.length ?? 0) > 0;
  const hasLinks = (links?.length ?? 0) > 0;
  return (
    <section className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </h3>
          {time ? (
            <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[11px] font-medium text-cyan-900">
              {time}
            </span>
          ) : null}
        </div>
        {mode && onModeChange ? (
          <ViewModePills value={mode} onChange={onModeChange} size="sm" />
        ) : null}
      </div>
      {empty && !hasImages && !hasLinks ? (
        <p className="mt-2 text-sm italic text-slate-400">Not filled yet</p>
      ) : (
        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
          {children}
        </div>
      )}
      {hasImages ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {images!.map((img) => (
            <figure
              key={img.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.url}
                  alt={img.caption || img.filename}
                  className="max-h-56 w-full object-contain bg-white"
                />
              ) : (
                <p className="p-3 text-xs text-slate-500">{img.filename}</p>
              )}
              {(img.caption || img.filename) && (
                <figcaption className="border-t border-slate-100 px-2.5 py-1.5 text-[11px] text-slate-600">
                  {img.caption || img.filename}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : null}
      {hasLinks ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {links!.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-slate-400"
            >
              {link.thumbnailUrl ? (
                <div className="relative bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={link.thumbnailUrl}
                    alt={link.caption || link.title || "Video"}
                    className="max-h-56 w-full object-cover opacity-95 transition group-hover:opacity-100"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
                      ▶ Open
                    </span>
                  </span>
                </div>
              ) : (
                <div className="flex min-h-24 items-center justify-center bg-slate-100 px-3 py-6 text-center text-xs text-slate-600">
                  {link.title || link.url}
                </div>
              )}
              <div className="border-t border-slate-100 px-2.5 py-1.5 text-[11px] text-slate-600">
                {link.caption || link.title || link.url}
              </div>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DifferentiationPreview() {
  return (
    <section className="border-b border-slate-100 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Differentiation / Tiers
        </h3>
        <StatusBadge status="fixed" />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Fixed support tiers — always included, not edited per lesson.
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {DIFFERENTIATION_IMAGES.map((img) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.id}
            src={img.src}
            alt={img.alt}
            className="block w-full bg-white"
          />
        ))}
      </div>
    </section>
  );
}

function StandardRubricPreview() {
  return (
    <section className="border-b border-slate-100 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {STANDARD_CLASSWORK_RUBRIC.title}
        </h3>
        <StatusBadge status="fixed" />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        District standard rubric — always included, not edited per lesson.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STANDARD_CLASSWORK_RUBRIC.levels.map((level) => (
          <div
            key={level.score}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <p className={`text-xs font-semibold ${level.headerClass}`}>
              {level.score} {level.label}
            </p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-4 text-slate-600">
              {level.criteria.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span aria-hidden className="mt-0.5 text-slate-400">
                    ☐
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function minutesInputValue(minutes: number | null | undefined): string {
  return minutes == null ? "" : String(minutes);
}

function parseMinutesInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function LessonPlanEditor({
  lessonId,
  draftTitle,
  initialContent,
  initialFreeTextAsks,
  initialModuleLabel,
  initialUnitLabel,
  initialLessonLabel,
  initialImageUrls = {},
}: LessonPlanEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [freeTextAsks, setFreeTextAsks] = useState(initialFreeTextAsks);
  const [moduleLabel, setModuleLabel] = useState(initialModuleLabel);
  const [unitLabel, setUnitLabel] = useState(initialUnitLabel);
  const [lessonLabel, setLessonLabel] = useState(initialLessonLabel);
  const [mobilePane, setMobilePane] = useState<"preview" | "edit">("preview");
  const [initialSnapshot] = useState(initialContent);
  const [workTimeCountDraft, setWorkTimeCountDraft] = useState(
    String(Math.max(1, initialContent.workTimes.length)),
  );
  const [openingMode, setOpeningMode] = useState<BodyViewMode>("edited");
  const [closingMode, setClosingMode] = useState<BodyViewMode>("edited");
  const [workTimeModes, setWorkTimeModes] = useState<Record<string, BodyViewMode>>(
    {},
  );
  const [imageUrls, setImageUrls] = useState<Record<string, string>>(initialImageUrls);
  const [imageSectionKey, setImageSectionKey] = useState("opening");
  const [imageCaption, setImageCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageMessage, setImageMessage] = useState<string | null>(null);
  const [linkSectionKey, setLinkSectionKey] = useState("opening");
  const [linkCaption, setLinkCaption] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  function workTimeModeFor(key: string): BodyViewMode {
    return workTimeModes[key] ?? "edited";
  }

  function setWorkTimeMode(key: string, mode: BodyViewMode) {
    setWorkTimeModes((prev) => ({ ...prev, [key]: mode }));
  }

  /** Plan-wide left-pane mode for Opening / Work Times / Closing. */
  function setAllPreviewModes(mode: BodyViewMode) {
    setOpeningMode(mode);
    setClosingMode(mode);
    setWorkTimeModes(() => {
      const next: Record<string, BodyViewMode> = {};
      for (const wt of content.workTimes) {
        next[wt.key] = mode;
      }
      return next;
    });
  }

  const previewModesAligned: BodyViewMode | "mixed" = (() => {
    const modes = [
      openingMode,
      closingMode,
      ...content.workTimes.map((wt) => workTimeModeFor(wt.key)),
    ];
    const first = modes[0] ?? "edited";
    return modes.every((m) => m === first) ? first : "mixed";
  })();

  function openFinalDraftPreview() {
    setAllPreviewModes("edited");
    setMobilePane("preview");
  }

  function previewImages(sectionKey: string) {
    return imagesForSection(content, sectionKey).map((img) => ({
      id: img.id,
      url: imageUrls[img.id],
      caption: img.caption,
      filename: img.originalFilename,
    }));
  }

  function previewLinks(sectionKey: string) {
    return linksForSection(content, sectionKey).map((link) => ({
      id: link.id,
      url: link.url,
      thumbnailUrl: link.thumbnailUrl,
      title: link.title,
      caption: link.caption,
    }));
  }

  async function onAddImage() {
    if (!imageFile || imageBusy) return;
    setImageBusy(true);
    setImageMessage(null);
    try {
      const formData = new FormData();
      formData.set("lessonId", lessonId);
      formData.set("sectionKey", imageSectionKey);
      formData.set("caption", imageCaption);
      formData.set("contentJson", JSON.stringify(content));
      formData.set("file", imageFile);
      const result = await uploadLessonImageAction(formData);
      if (!result.ok) {
        setImageMessage(
          LESSON_ERROR_MESSAGES[result.error as LessonErrorCode] ??
            "Image upload failed.",
        );
        return;
      }
      setContent(result.content);
      if (result.imageId && result.signedUrl) {
        setImageUrls((prev) => ({
          ...prev,
          [result.imageId!]: result.signedUrl!,
        }));
      }
      setImageFile(null);
      setImageCaption("");
      setImageMessage("Image added under that section.");
    } catch (error) {
      console.error(error);
      setImageMessage("Image upload failed. Please try again.");
    } finally {
      setImageBusy(false);
    }
  }

  async function onRemoveImage(imageId: string) {
    if (imageBusy) return;
    setImageBusy(true);
    setImageMessage(null);
    try {
      const formData = new FormData();
      formData.set("lessonId", lessonId);
      formData.set("imageId", imageId);
      formData.set("contentJson", JSON.stringify(content));
      const result = await removeLessonImageAction(formData);
      if (!result.ok) {
        setImageMessage(
          LESSON_ERROR_MESSAGES[result.error as LessonErrorCode] ??
            "Could not remove that image.",
        );
        return;
      }
      setContent(result.content);
      setImageUrls((prev) => {
        const next = { ...prev };
        delete next[imageId];
        return next;
      });
      setImageMessage("Image removed.");
    } catch (error) {
      console.error(error);
      setImageMessage("Could not remove that image.");
    } finally {
      setImageBusy(false);
    }
  }

  async function onAddLink() {
    if (!linkUrl.trim() || linkBusy) return;
    setLinkBusy(true);
    setLinkMessage(null);
    try {
      const formData = new FormData();
      formData.set("lessonId", lessonId);
      formData.set("sectionKey", linkSectionKey);
      formData.set("caption", linkCaption);
      formData.set("url", linkUrl.trim());
      formData.set("contentJson", JSON.stringify(content));
      const result = await addLessonPlanLinkAction(formData);
      if (!result.ok) {
        setLinkMessage(
          LESSON_ERROR_MESSAGES[result.error as LessonErrorCode] ??
            "Could not add that link.",
        );
        return;
      }
      setContent(result.content);
      setLinkUrl("");
      setLinkCaption("");
      setLinkMessage("Link added under that section.");
    } catch (error) {
      console.error(error);
      setLinkMessage("Could not add that link. Please try again.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function onRemoveLink(linkId: string) {
    if (linkBusy) return;
    setLinkBusy(true);
    setLinkMessage(null);
    try {
      const formData = new FormData();
      formData.set("lessonId", lessonId);
      formData.set("linkId", linkId);
      formData.set("contentJson", JSON.stringify(content));
      const result = await removeLessonPlanLinkAction(formData);
      if (!result.ok) {
        setLinkMessage(
          LESSON_ERROR_MESSAGES[result.error as LessonErrorCode] ??
            "Could not remove that link.",
        );
        return;
      }
      setContent(result.content);
      setLinkMessage("Link removed.");
    } catch (error) {
      console.error(error);
      setLinkMessage("Could not remove that link.");
    } finally {
      setLinkBusy(false);
    }
  }

  const sectionOptions = imageSectionOptionsForContent(content);
  const worksheetImages = imagesForSection(content, "worksheets");
  const anchorChartImages = imagesForSection(content, "anchorCharts");

  const learningTargets = findExtra(content, "Learning Targets");
  const homework = findExtra(content, "Homework");
  const initialTargets = findExtra(initialSnapshot, "Learning Targets");
  const initialHomework = findExtra(initialSnapshot, "Homework");

  const otherExtras = content.extras
    .map((extra, index) => ({ extra, index }))
    .filter(
      ({ extra }) =>
        extra.label.toLowerCase() !== "learning targets" &&
        extra.label.toLowerCase() !== "homework",
    );

  const standardsCodes = parseStandardsCodes(content.standards);
  const workBodiesFilled = content.workTimes.some((w) => normalize(w.body));

  const provenance: { label: string; status: FieldStatus }[] = [
    {
      label: "Standards",
      status: statusForText(initialSnapshot.standards, content.standards),
    },
    {
      label: "Learning Targets",
      status: statusForText(
        initialTargets?.body ?? "",
        learningTargets?.body ?? "",
      ),
    },
    {
      label: "Agenda",
      status: statusForText(initialSnapshot.agenda, content.agenda),
    },
    {
      label: "Entrance Ticket",
      status: statusForText(
        initialSnapshot.entranceTicket,
        content.entranceTicket,
      ),
    },
    {
      label: "Vocabulary",
      status: statusForText(initialSnapshot.vocabulary, content.vocabulary),
    },
    { label: "Classwork Rubric", status: "fixed" },
    {
      label: "Materials",
      status: statusForText(initialSnapshot.materials, content.materials),
    },
    {
      label: "Opening",
      status: statusForText(
        initialSnapshot.opening.body,
        content.opening.body,
      ),
    },
    {
      label: "Closing",
      status: statusForText(
        initialSnapshot.closing.body,
        content.closing.body,
      ),
    },
    {
      label: "Homework",
      status: statusForText(
        initialHomework?.body ?? "",
        homework?.body ?? "",
      ),
    },
    {
      label: "Work Time bodies",
      status: workBodiesFilled
        ? statusForText(
            initialSnapshot.workTimes.map((w) => w.body).join("\n"),
            content.workTimes.map((w) => w.body).join("\n"),
          )
        : "empty",
    },
  ];

  function onWorkTimeCountDraftChange(event: ChangeEvent<HTMLInputElement>) {
    // Digits only; never resize while typing (avoids clamp-to-1/8 on clear).
    setWorkTimeCountDraft(event.target.value.replace(/\D/g, "").slice(0, 1));
  }

  function commitWorkTimeCount() {
    const count = Number(workTimeCountDraft);
    if (!Number.isInteger(count) || count < 1 || count > 8) {
      setWorkTimeCountDraft(String(Math.max(1, content.workTimes.length)));
      return;
    }
    setWorkTimeCountDraft(String(count));
    setContent((prev) => resizeWorkTimes(prev, count));
  }

  function setExtraBody(index: number, body: string) {
    setContent((prev) => ({
      ...prev,
      extras: prev.extras.map((item, i) =>
        i === index ? { ...item, body } : item,
      ),
    }));
  }

  const preview = (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Reference preview
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {moduleLabel || unitLabel || lessonLabel
                ? [
                    moduleLabel ? `Module ${moduleLabel}` : null,
                    unitLabel ? `Unit ${unitLabel}` : null,
                    lessonLabel ? `Lesson ${lessonLabel}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Lesson draft"}
            </h2>
            {content.lessonDate ? (
              <p className="mt-1 text-sm text-slate-500">{content.lessonDate}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            onClick={openFinalDraftPreview}
          >
            Preview final draft
          </button>
        </div>
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            Swap Opening / Work Time / Closing here to copy or compare. Right side
            stays your editable <span className="font-medium text-slate-700">Edited</span>{" "}
            draft.{" "}
            <span className="font-medium text-slate-700">Preview final draft</span>{" "}
            jumps everything back to Edited.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              All long sections
            </span>
            <ViewModePills
              value={
                previewModesAligned === "mixed" ? null : previewModesAligned
              }
              onChange={setAllPreviewModes}
            />
            {previewModesAligned === "mixed" ? (
              <span className="text-[11px] text-amber-800">Mixed per section</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          From this upload
        </p>
        <ul className="mt-3 space-y-2">
          {provenance.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 text-sm text-slate-700"
            >
              <span>{item.label}</span>
              <StatusBadge status={item.status} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Opening, Closing, and Work Time keep Original + Simplified from the
          parser; only Edited is saved as your working draft for generation.
        </p>
      </div>

      <article className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {previewImages("general").length > 0 ||
        previewLinks("general").length > 0 ? (
          <PreviewSection
            title="General"
            images={previewImages("general")}
            links={previewLinks("general")}
          />
        ) : null}

        <PreviewSection title="Standards" empty={standardsCodes.length === 0}>
          <div className="flex flex-wrap gap-2">
            {standardsCodes.map((code) => (
              <span
                key={code}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {code}
              </span>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection
          title="Learning Targets"
          empty={!normalize(learningTargets?.body ?? "")}
          images={previewImages("learningTargets")}
          links={previewLinks("learningTargets")}
        >
          {learningTargets?.body}
        </PreviewSection>

        <PreviewSection
          title="Agenda"
          empty={!normalize(content.agenda)}
          images={previewImages("agenda")}
          links={previewLinks("agenda")}
        >
          {content.agenda}
        </PreviewSection>

        <PreviewSection
          title="Entrance Ticket"
          empty={!normalize(content.entranceTicket)}
          images={previewImages("entranceTicket")}
          links={previewLinks("entranceTicket")}
        >
          {content.entranceTicket}
        </PreviewSection>

        <PreviewSection
          title="Vocabulary"
          empty={!normalize(content.vocabulary)}
          images={previewImages("vocabulary")}
          links={previewLinks("vocabulary")}
        >
          {content.vocabulary}
        </PreviewSection>

        <StandardRubricPreview />

        <PreviewSection
          title="Materials"
          empty={!normalize(content.materials)}
          images={previewImages("materials")}
          links={previewLinks("materials")}
        >
          {content.materials}
        </PreviewSection>

        <PreviewSection
          title={content.opening.label || "Opening"}
          empty={!normalize(bodyForViewMode(content.opening, openingMode))}
          minutes={content.opening.minutes}
          mode={openingMode}
          onModeChange={setOpeningMode}
          images={previewImages("opening")}
          links={previewLinks("opening")}
        >
          {bodyForViewMode(content.opening, openingMode)}
        </PreviewSection>

        {content.workTimes.map((wt) => {
          const mode = workTimeModeFor(wt.key);
          const text = bodyForViewMode(wt, mode);
          return (
            <PreviewSection
              key={wt.key}
              title={wt.label || `Work Time ${wt.key}`}
              empty={!normalize(text)}
              minutes={wt.minutes}
              mode={mode}
              onModeChange={(next) => setWorkTimeMode(wt.key, next)}
              images={previewImages(`workTime:${wt.key}`)}
              links={previewLinks(`workTime:${wt.key}`)}
            >
              {text}
            </PreviewSection>
          );
        })}

        <PreviewSection
          title={content.closing.label || "Closing"}
          empty={!normalize(bodyForViewMode(content.closing, closingMode))}
          minutes={content.closing.minutes}
          mode={closingMode}
          onModeChange={setClosingMode}
          images={previewImages("closing")}
          links={previewLinks("closing")}
        >
          {bodyForViewMode(content.closing, closingMode)}
        </PreviewSection>

        <PreviewSection
          title="Homework"
          empty={!normalize(homework?.body ?? "")}
          images={previewImages("homework")}
          links={previewLinks("homework")}
        >
          {homework?.body}
        </PreviewSection>

        <DifferentiationPreview />

        <PreviewSection
          title="Worksheets"
          empty={
            worksheetImages.length === 0 &&
            previewLinks("worksheets").length === 0
          }
          images={previewImages("worksheets")}
          links={previewLinks("worksheets")}
        />

        <PreviewSection
          title="Anchor Charts"
          empty={
            anchorChartImages.length === 0 &&
            previewLinks("anchorCharts").length === 0
          }
          images={previewImages("anchorCharts")}
          links={previewLinks("anchorCharts")}
        />

        {otherExtras.map(({ extra }) => (
          <PreviewSection
            key={extra.label}
            title={extra.label}
            empty={!normalize(extra.body)}
          >
            {extra.body}
          </PreviewSection>
        ))}
      </article>
    </div>
  );

  const editor = (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Edit fields</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Always edits your <span className="font-medium text-slate-700">Edited</span>{" "}
          draft. Use the left preview to reference Simplified / Original while you
          type — then hit <span className="font-medium text-slate-700">Preview final draft</span>{" "}
          to see the whole Edited plan again.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Standards (codes)"
          status={statusForText(initialSnapshot.standards, content.standards)}
          hint="Codes only — comma-separated"
        />
        {standardsCodes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {standardsCodes.map((code) => (
              <span
                key={code}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {code}
              </span>
            ))}
          </div>
        ) : null}
        <input
          className={inputClass}
          value={content.standards}
          onChange={(e) =>
            setContent((prev) => ({ ...prev, standards: e.target.value }))
          }
          placeholder="8R1, 8R6, RST3"
        />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Learning Targets"
          status={statusForText(
            initialTargets?.body ?? "",
            learningTargets?.body ?? "",
          )}
        />
        {learningTargets ? (
          <textarea
            className={textareaClass}
            value={learningTargets.body}
            onChange={(e) => setExtraBody(learningTargets.index, e.target.value)}
          />
        ) : (
          <p className="text-sm text-slate-500">
            None detected from this upload.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Agenda"
          status={statusForText(initialSnapshot.agenda, content.agenda)}
        />
        <textarea
          className={textareaClass}
          value={content.agenda}
          onChange={(e) =>
            setContent((prev) => ({ ...prev, agenda: e.target.value }))
          }
        />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Entrance Ticket"
          status={statusForText(
            initialSnapshot.entranceTicket,
            content.entranceTicket,
          )}
          hint="Student-facing prompt from the framework"
        />
        <textarea
          className={textareaClass}
          value={content.entranceTicket}
          onChange={(e) =>
            setContent((prev) => ({
              ...prev,
              entranceTicket: e.target.value,
            }))
          }
          placeholder="Entrance ticket question…"
        />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Vocabulary"
          status={statusForText(
            initialSnapshot.vocabulary,
            content.vocabulary,
          )}
          hint="Usually kept as-is from the framework"
        />
        <textarea
          className={textareaClass}
          value={content.vocabulary}
          onChange={(e) =>
            setContent((prev) => ({ ...prev, vocabulary: e.target.value }))
          }
          placeholder="Academic / domain vocabulary…"
        />
      </div>

      <div className="space-y-2 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-5 shadow-sm">
        <FieldHeader
          title="Classwork / Homework Rubric"
          status="fixed"
          hint="Mandated formula block — same every lesson"
        />
        <p className="text-sm text-slate-600">
          Shown above Materials in the preview. Not editable here.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Materials"
          status={statusForText(initialSnapshot.materials, content.materials)}
        />
        <textarea
          className={textareaClass}
          value={content.materials}
          onChange={(e) =>
            setContent((prev) => ({ ...prev, materials: e.target.value }))
          }
        />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Opening"
          status={statusForText(
            initialSnapshot.opening.body,
            content.opening.body,
          )}
          hint="Your editable draft (starts as Original)"
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <label className="block">
            <span className={labelClass}>Label</span>
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
            <span className={labelClass}>Minutes</span>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={minutesInputValue(content.opening.minutes)}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  opening: {
                    ...prev.opening,
                    minutes: parseMinutesInput(e.target.value),
                  },
                }))
              }
            />
          </label>
        </div>
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
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Work Time"
          status={
            workBodiesFilled
              ? statusForText(
                  initialSnapshot.workTimes.map((w) => w.body).join("\n"),
                  content.workTimes.map((w) => w.body).join("\n"),
                )
              : "empty"
          }
          hint={`Pre-filled from the framework (${content.workTimes.length} block(s)). Lowering count parks extras so you can restore them.`}
        />
        <label className="block max-w-32">
          <span className={labelClass}>Block count</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[1-8]"
            autoComplete="off"
            className={inputClass}
            value={workTimeCountDraft}
            onChange={onWorkTimeCountDraftChange}
            onBlur={commitWorkTimeCount}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitWorkTimeCount();
              }
            }}
          />
          <p className="mt-1 text-[11px] text-slate-500">1–8 · applies on blur</p>
        </label>
        {(content.workTimesReservoir?.length ?? 0) > 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
            {content.workTimesReservoir.length} Work Time block(s) parked from a
            lower count — raise the block count to bring them back (with Original
            + Simplified intact).
          </p>
        ) : null}
        {content.workTimes.map((wt, index) => (
          <div key={wt.key} className="space-y-2 border-t border-slate-100 pt-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
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
                <span className={labelClass}>Minutes</span>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={minutesInputValue(wt.minutes)}
                  onChange={(e) => {
                    const minutes = parseMinutesInput(e.target.value);
                    setContent((prev) => ({
                      ...prev,
                      workTimes: prev.workTimes.map((block, i) =>
                        i === index ? { ...block, minutes } : block,
                      ),
                    }));
                  }}
                />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>
                Work Time {wt.key} description
              </span>
              <textarea
                className={`${textareaClass} min-h-36`}
                value={wt.body}
                placeholder="Work Time instructional steps…"
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
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Closing"
          status={statusForText(
            initialSnapshot.closing.body,
            content.closing.body,
          )}
          hint="Your editable draft (starts as Original)"
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <label className="block">
            <span className={labelClass}>Label</span>
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
            <span className={labelClass}>Minutes</span>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={minutesInputValue(content.closing.minutes)}
              onChange={(e) =>
                setContent((prev) => ({
                  ...prev,
                  closing: {
                    ...prev.closing,
                    minutes: parseMinutesInput(e.target.value),
                  },
                }))
              }
            />
          </label>
        </div>
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
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Homework"
          status={statusForText(
            initialHomework?.body ?? "",
            homework?.body ?? "",
          )}
          hint="Starting text from the framework — adjust as needed"
        />
        {homework ? (
          <textarea
            className={textareaClass}
            value={homework.body}
            onChange={(e) => setExtraBody(homework.index, e.target.value)}
          />
        ) : (
          <p className="text-sm text-slate-500">
            None detected from this upload.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Differentiation / Tiers"
          status="fixed"
          hint="Always shown under Homework in the preview — not edited here."
        />
        <p className="text-sm text-slate-500">
          Fixed tier supports appear on every lesson draft. Use the left preview
          to review them.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Worksheets"
          status={worksheetImages.length > 0 ? "edited" : "empty"}
          hint="Upload under Images and choose Worksheets in the section dropdown."
        />
        <p className="text-sm text-slate-500">
          {worksheetImages.length > 0
            ? `${worksheetImages.length} worksheet image(s) attached — manage them in Images below.`
            : "No worksheets yet — add images and attach them to Worksheets."}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Anchor Charts"
          status={anchorChartImages.length > 0 ? "edited" : "empty"}
          hint="Upload under Images and choose Anchor Charts in the section dropdown."
        />
        <p className="text-sm text-slate-500">
          {anchorChartImages.length > 0
            ? `${anchorChartImages.length} anchor chart image(s) attached — manage them in Images below.`
            : "No anchor charts yet — add images and attach them to Anchor Charts."}
        </p>
      </div>

      {otherExtras.length > 0 ? (
        <div className="space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Other parsed sections
          </h2>
          {otherExtras.map(({ extra, index }) => (
            <label key={`${extra.label}-${index}`} className="block">
              <span className={labelClass}>{extra.label}</span>
              <textarea
                className={textareaClass}
                value={extra.body}
                onChange={(e) => setExtraBody(index, e.target.value)}
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Images"
          status={(content.images?.length ?? 0) > 0 ? "edited" : "empty"}
          hint="After edits — upload PNG/JPEG/WebP/GIF and pick which section it belongs under (including Worksheets and Anchor Charts)."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClass}>Image file</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
              className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700`}
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                setImageFile(next);
                setImageMessage(null);
              }}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Attach under section</span>
            <select
              className={inputClass}
              value={imageSectionKey}
              onChange={(e) => setImageSectionKey(e.target.value)}
            >
              {sectionOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Caption (optional)</span>
            <input
              className={inputClass}
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              placeholder="Short label for the image"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={buttonClass}
            disabled={!imageFile || imageBusy}
            onClick={() => void onAddImage()}
          >
            {imageBusy ? "Working…" : "Add image"}
          </button>
          {imageFile ? (
            <span className="text-xs text-slate-500">{imageFile.name}</span>
          ) : null}
        </div>
        {imageMessage ? (
          <p className="text-xs text-slate-600">{imageMessage}</p>
        ) : null}

        {(content.images?.length ?? 0) > 0 ? (
          <ul className="space-y-3 border-t border-slate-100 pt-4">
            {content.images.map((img) => {
              const sectionLabel =
                sectionOptions.find((o) => o.key === img.sectionKey)?.label ??
                img.sectionKey;
              return (
                <li
                  key={img.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 p-3"
                >
                  {imageUrls[img.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrls[img.id]}
                      alt={img.caption || img.originalFilename}
                      className="h-16 w-16 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-500">
                      No preview
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {img.originalFilename}
                    </p>
                    <p className="text-xs text-slate-500">Under: {sectionLabel}</p>
                    {img.caption ? (
                      <p className="text-xs text-slate-600">{img.caption}</p>
                    ) : null}
                    <label className="mt-2 block max-w-xs">
                      <span className={labelClass}>Move to section</span>
                      <select
                        className={inputClass}
                        value={img.sectionKey}
                        onChange={(e) => {
                          const sectionKey = e.target.value;
                          setContent((prev) => ({
                            ...prev,
                            images: prev.images.map((item) =>
                              item.id === img.id ? { ...item, sectionKey } : item,
                            ),
                          }));
                        }}
                      >
                        {sectionOptions.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    disabled={imageBusy}
                    onClick={() => void onRemoveImage(img.id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No images on this draft yet.</p>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <FieldHeader
          title="Links / Videos"
          status={
            (content.lessonPlanLinks?.length ?? 0) > 0 ? "edited" : "empty"
          }
          hint="Paste a YouTube (or other https) URL and attach it under a section. Thumbnails open the video in a new tab."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClass}>Video / link URL</span>
            <input
              className={inputClass}
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                setLinkMessage(null);
              }}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Attach under section</span>
            <select
              className={inputClass}
              value={linkSectionKey}
              onChange={(e) => setLinkSectionKey(e.target.value)}
            >
              {sectionOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Caption (optional)</span>
            <input
              className={inputClass}
              value={linkCaption}
              onChange={(e) => setLinkCaption(e.target.value)}
              placeholder="Short label for the link"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={buttonClass}
            disabled={!linkUrl.trim() || linkBusy}
            onClick={() => void onAddLink()}
          >
            {linkBusy ? "Working…" : "Add link"}
          </button>
        </div>
        {linkMessage ? (
          <p className="text-xs text-slate-600">{linkMessage}</p>
        ) : null}

        {(content.lessonPlanLinks?.length ?? 0) > 0 ? (
          <ul className="space-y-3 border-t border-slate-100 pt-4">
            {content.lessonPlanLinks.map((link) => {
              const sectionLabel =
                sectionOptions.find((o) => o.key === link.sectionKey)?.label ??
                link.sectionKey;
              return (
                <li
                  key={link.id}
                  className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 p-3"
                >
                  {link.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={link.thumbnailUrl}
                      alt={link.caption || link.title}
                      className="h-16 w-16 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-slate-100 text-[10px] text-slate-500">
                      Link
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {link.title || link.url}
                    </p>
                    <p className="truncate text-xs text-slate-500">{link.url}</p>
                    <p className="text-xs text-slate-500">Under: {sectionLabel}</p>
                    {link.caption ? (
                      <p className="text-xs text-slate-600">{link.caption}</p>
                    ) : null}
                    <label className="mt-2 block max-w-xs">
                      <span className={labelClass}>Move to section</span>
                      <select
                        className={inputClass}
                        value={link.sectionKey}
                        onChange={(e) => {
                          const sectionKey = e.target.value;
                          setContent((prev) => ({
                            ...prev,
                            lessonPlanLinks: (prev.lessonPlanLinks ?? []).map(
                              (item) =>
                                item.id === link.id
                                  ? { ...item, sectionKey }
                                  : item,
                            ),
                          }));
                        }}
                      >
                        {sectionOptions.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    disabled={linkBusy}
                    onClick={() => void onRemoveLink(link.id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No links on this draft yet.</p>
        )}
      </div>

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
          Last step — free-form asks for Ticket 7 AI generation. Saved on this draft
          now.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 lg:hidden">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mobilePane === "preview"
                ? "bg-slate-900 text-white"
                : "text-slate-600"
            }`}
            onClick={() => setMobilePane("preview")}
          >
            Preview
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mobilePane === "edit" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
            onClick={() => setMobilePane("edit")}
          >
            Edit
          </button>
        </div>
        <div className="ml-auto">
          <DeleteLessonDraftButton
            lessonId={lessonId}
            draftTitle={draftTitle}
            variant="button"
          />
        </div>
      </div>

      <form action={saveLessonPlanAction} className="space-y-4">
        <input type="hidden" name="lessonId" value={lessonId} />
        <input
          type="hidden"
          name="contentJson"
          value={JSON.stringify(content)}
        />
        <input type="hidden" name="freeTextAsks" value={freeTextAsks} />
        <input type="hidden" name="moduleLabel" value={moduleLabel} />
        <input type="hidden" name="unitLabel" value={unitLabel} />
        <input type="hidden" name="lessonLabel" value={lessonLabel} />

        <div className="grid gap-6 lg:grid-cols-2">
          <div
            className={`lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto ${
              mobilePane === "preview" ? "block" : "hidden lg:block"
            }`}
          >
            {preview}
          </div>
          <div className={mobilePane === "edit" ? "block" : "hidden lg:block"}>
            {editor}
          </div>
        </div>

        <div className="flex justify-end">
          <PendingSubmitButton
            idleLabel="Save draft"
            pendingLabel="Saving…"
            className={buttonClass}
          />
        </div>
      </form>
    </div>
  );
}

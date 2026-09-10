/**
 * Resolve video/page URLs into thumbnail metadata for content.lessonPlanLinks.
 * YouTube uses public thumbnail URLs (no API key). Other https links are allowed
 * without a thumbnail.
 */
import { randomUUID } from "node:crypto";
import type { LessonPlanContent, LessonPlanLink } from "./content";
import { parseLessonPlanContent } from "./content";
import { imageSectionOptionsForContent } from "./imageSections";
import { getLessonPlanForTeacher, updateLessonPlanContent } from "./plans";

export type ResolvedLessonLink = {
  url: string;
  thumbnailUrl: string;
  title: string;
  provider: "youtube" | "vimeo" | "other";
};

export class InvalidLessonLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLessonLinkError";
  }
}

/** Extract YouTube video id from common URL shapes. */
export function extractYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return /^[\w-]{11}$/.test(id) ? id : null;
  }

  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;

    const parts = url.pathname.split("/").filter(Boolean);
    if (
      parts.length >= 2 &&
      ["embed", "shorts", "live", "v"].includes(parts[0]!.toLowerCase())
    ) {
      const id = parts[1]!;
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
  }

  return null;
}

function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Normalize + resolve a pasted link. Throws InvalidLessonLinkError on bad input.
 */
export function resolveLessonPlanLink(rawUrl: string): ResolvedLessonLink {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new InvalidLessonLinkError("Paste a video URL.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new InvalidLessonLinkError("That doesn’t look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidLessonLinkError("Use an http or https link.");
  }

  const youtubeId = extractYoutubeVideoId(url.toString());
  if (youtubeId) {
    return {
      url: youtubeWatchUrl(youtubeId),
      thumbnailUrl: youtubeThumbnailUrl(youtubeId),
      title: "YouTube video",
      provider: "youtube",
    };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
    return {
      url: url.toString(),
      thumbnailUrl: "",
      title: "Vimeo video",
      provider: "vimeo",
    };
  }

  return {
    url: url.toString(),
    thumbnailUrl: "",
    title: host || "Link",
    provider: "other",
  };
}

export async function addLessonPlanLink(input: {
  teacherId: string;
  lessonPlanId: string;
  url: string;
  sectionKey: string;
  caption?: string;
  draftContent?: LessonPlanContent;
}): Promise<{ link: LessonPlanLink; content: LessonPlanContent }> {
  const plan = await getLessonPlanForTeacher(
    input.teacherId,
    input.lessonPlanId,
  );
  if (!plan) {
    throw new Error("Lesson plan not found");
  }

  const content = parseLessonPlanContent(input.draftContent ?? plan.content);
  const allowed = new Set(
    imageSectionOptionsForContent(content).map((o) => o.key),
  );
  if (!allowed.has(input.sectionKey)) {
    throw new Error("Invalid link section");
  }

  const resolved = resolveLessonPlanLink(input.url);
  const link: LessonPlanLink = {
    id: randomUUID(),
    sectionKey: input.sectionKey,
    url: resolved.url,
    thumbnailUrl: resolved.thumbnailUrl,
    title: resolved.title,
    caption: (input.caption ?? "").trim(),
    provider: resolved.provider,
  };

  const nextContent: LessonPlanContent = {
    ...content,
    lessonPlanLinks: [...(content.lessonPlanLinks ?? []), link],
  };

  const updated = await updateLessonPlanContent({
    teacherId: input.teacherId,
    lessonPlanId: input.lessonPlanId,
    content: nextContent,
  });

  return {
    link,
    content: parseLessonPlanContent(updated.content),
  };
}

export async function removeLessonPlanLink(input: {
  teacherId: string;
  lessonPlanId: string;
  linkId: string;
  draftContent?: LessonPlanContent;
}): Promise<LessonPlanContent> {
  const plan = await getLessonPlanForTeacher(
    input.teacherId,
    input.lessonPlanId,
  );
  if (!plan) {
    throw new Error("Lesson plan not found");
  }

  const content = parseLessonPlanContent(input.draftContent ?? plan.content);
  const exists = (content.lessonPlanLinks ?? []).some(
    (l) => l.id === input.linkId,
  );
  if (!exists) {
    throw new Error("Link not found on this draft");
  }

  const nextContent: LessonPlanContent = {
    ...content,
    lessonPlanLinks: (content.lessonPlanLinks ?? []).filter(
      (l) => l.id !== input.linkId,
    ),
  };

  const updated = await updateLessonPlanContent({
    teacherId: input.teacherId,
    lessonPlanId: input.lessonPlanId,
    content: nextContent,
  });

  return parseLessonPlanContent(updated.content);
}

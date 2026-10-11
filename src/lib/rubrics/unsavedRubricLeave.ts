import type { RubricCriteria } from "@/lib/rubrics/criteria";

export function rubricEditorSnapshot(
  name: string,
  criteria: RubricCriteria,
): string {
  return JSON.stringify({ name: name.trim(), criteria });
}

export function isRubricEditorDirty(
  savedSnapshot: string,
  name: string,
  criteria: RubricCriteria,
): boolean {
  return rubricEditorSnapshot(name, criteria) !== savedSnapshot;
}

/**
 * Destination to hold, or null when this click can leave the page.
 * Same-page clicks, new tabs, and downloads stay available.
 */
export function rubricLeaveHref(input: {
  href: string | null;
  currentUrl: string;
  target: string | null;
  hasDownload: boolean;
  modifiedClick: boolean;
}): string | null {
  if (input.modifiedClick || input.hasDownload) return null;
  if (input.target === "_blank") return null;

  const href = input.href?.trim() ?? "";
  if (!href || href.startsWith("#")) return null;

  let next: URL;
  try {
    next = new URL(href, input.currentUrl);
  } catch {
    return null;
  }

  const current = new URL(input.currentUrl);
  if (
    next.origin === current.origin &&
    next.pathname === current.pathname &&
    next.search === current.search &&
    next.hash === current.hash
  ) {
    return null;
  }

  if (next.origin !== current.origin) return next.href;
  return `${next.pathname}${next.search}${next.hash}`;
}

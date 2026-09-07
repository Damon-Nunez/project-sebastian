import type { User } from "@supabase/supabase-js";

/**
 * Prefer Google full_name / name from Auth user_metadata.
 */
export function displayNameFromAuthUser(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const candidates = [meta.full_name, meta.name, meta.display_name];

  for (const value of candidates) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

/**
 * Initials for avatar: first + last word, or first two letters of one word.
 */
export function initialsFromDisplayName(
  name: string | null | undefined,
  emailFallback?: string | null,
): string {
  const source = (name ?? "").trim() || (emailFallback ?? "").trim();
  if (!source) {
    return "?";
  }

  if (source.includes("@")) {
    const local = source.split("@")[0] ?? "";
    return (local.slice(0, 2) || "?").toUpperCase();
  }

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }

  const first = parts[0]![0] ?? "";
  const last = parts[parts.length - 1]![0] ?? "";
  return `${first}${last}`.toUpperCase();
}
